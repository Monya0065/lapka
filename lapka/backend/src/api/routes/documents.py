import mimetypes
import os
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.sanitize import sanitize_text
from src.db.session import get_db_session
from src.models import ConsentScope, Document, RoleEnum
from src.security.deps import enforce_pet_scope, get_current_user, require_owner_of_pet
from src.services.ai_safe import explain_document
from src.services.audit import log_audit
from src.services.ai_runtime import execute_governed_ai
from src.services.document_download_token import sign_document_file_link, verify_document_file_link

router = APIRouter(prefix="/documents", tags=["documents"])

DOWNLOAD_LINK_TTL_SEC = 900
STORAGE_ROOT = Path("storage").resolve()


class DocumentUploadRequest(BaseModel):
    pet_id: str
    clinic_id: str
    doc_type: str
    file_ref: str


class DocumentDeleteResponse(BaseModel):
    status: str


def _serialize_doc(doc: Document) -> dict:
    return {
        "id": str(doc.id),
        "pet_id": str(doc.pet_id),
        "clinic_id": str(doc.clinic_id),
        "uploaded_by": str(doc.uploaded_by),
        "doc_type": doc.doc_type,
        "file_ref": doc.file_ref,
        "created_at": doc.created_at,
    }


async def _fetch_authorized_document(
    db: AsyncSession,
    current_user,
    doc_id: str,
) -> Document:
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid document id"},
        ) from exc

    doc = await db.scalar(select(Document).where(Document.id == doc_uuid))
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=doc.pet_id)
    else:
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=doc.pet_id,
            clinic_id=doc.clinic_id,
            required_scope=ConsentScope.full_record,
        )
    return doc


def _resolved_storage_file_path(file_ref: str) -> Path:
    rel = (file_ref or "").strip().lstrip("/")
    if not rel or ".." in rel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    full = (Path("storage") / rel).resolve()
    try:
        full.relative_to(STORAGE_ROOT)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        ) from exc
    if not full.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    return full


def _sanitize_file_ref(raw: str) -> str:
    cleaned = sanitize_text(raw, max_len=512)
    if ".." in cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid file_ref"},
        )
    return cleaned


@router.get("")
async def list_documents(
    pet_id: str | None = None,
    clinic_id: str | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    q = select(Document).order_by(Document.created_at.desc()).limit(200)
    try:
        if pet_id:
            q = q.where(Document.pet_id == uuid.UUID(pet_id))
        if clinic_id:
            q = q.where(Document.clinic_id == uuid.UUID(clinic_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid pet_id/clinic_id"},
        ) from exc

    rows = (await db.scalars(q)).all()
    out: list[dict] = []
    for row in rows:
        try:
            if current_user.role == RoleEnum.owner:
                await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=row.pet_id)
            else:
                await enforce_pet_scope(
                    db,
                    current_user=current_user,
                    pet_id=row.pet_id,
                    clinic_id=row.clinic_id,
                    required_scope=ConsentScope.full_record,
                )
            out.append(_serialize_doc(row))
        except HTTPException:
            continue
    return out


@router.post("/upload-metadata", status_code=status.HTTP_201_CREATED)
async def upload_document_metadata(
    payload: DocumentUploadRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        pet_id = uuid.UUID(sanitize_text(payload.pet_id, max_len=64))
        clinic_id = uuid.UUID(sanitize_text(payload.clinic_id, max_len=64))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid pet_id/clinic_id"},
        ) from exc

    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_id)
    else:
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=pet_id,
            clinic_id=clinic_id,
            required_scope=ConsentScope.full_record,
        )

    doc = Document(
        pet_id=pet_id,
        clinic_id=clinic_id,
        uploaded_by=current_user.id,
        doc_type=sanitize_text(payload.doc_type, max_len=128),
        file_ref=_sanitize_file_ref(payload.file_ref),
    )
    db.add(doc)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_id),
        action="document.upload",
        target_type="document",
        target_id=str(doc.id),
    )
    await db.commit()
    await db.refresh(doc)

    return {"id": str(doc.id), "status": "uploaded"}


DOCUMENT_UPLOAD_DIR = Path("storage/documents")
ALLOWED_DOC_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


async def _save_uploaded_document(upload: UploadFile, pet_id: uuid.UUID) -> str:
    """Save uploaded file to storage/documents/{pet_id}/ and return file_ref path."""
    raw_name = upload.filename or "file"
    ext = os.path.splitext(raw_name)[1].lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "code": "UNSUPPORTED_MEDIA_TYPE",
                "message": f"Allowed: PDF, PNG, JPG, WEBP. Got: {ext or 'unknown'}",
            },
        )
    target_dir = DOCUMENT_UPLOAD_DIR / str(pet_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid.uuid4()}{ext}"
    file_path = target_dir / file_name
    # file_ref stored as relative to storage root for /storage/ serving
    file_ref = f"documents/{pet_id}/{file_name}"
    data = await upload.read()
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "PAYLOAD_TOO_LARGE", "message": f"File size must be <= {MAX_FILE_SIZE_BYTES // (1024*1024)} MB"},
        )
    file_path.write_bytes(data)
    return file_ref


@router.post("/upload-file", status_code=status.HTTP_201_CREATED)
async def upload_document_file(
    file: UploadFile = File(...),
    pet_id: str = Form(...),
    clinic_id: str = Form(...),
    doc_type: str = Form(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Multipart upload: saves file to storage, creates document metadata."""
    try:
        pet_uuid = uuid.UUID(sanitize_text(pet_id, max_len=64))
        clinic_uuid = uuid.UUID(sanitize_text(clinic_id, max_len=64))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid pet_id or clinic_id"},
        ) from exc

    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
    else:
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=pet_uuid,
            clinic_id=clinic_uuid,
            required_scope=ConsentScope.full_record,
        )

    file_ref = await _save_uploaded_document(file, pet_uuid)

    doc = Document(
        pet_id=pet_uuid,
        clinic_id=clinic_uuid,
        uploaded_by=current_user.id,
        doc_type=sanitize_text(doc_type, max_len=128),
        file_ref=file_ref,
    )
    db.add(doc)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="document.upload",
        target_type="document",
        target_id=str(doc.id),
    )
    await db.commit()
    await db.refresh(doc)
    return {"id": str(doc.id), "status": "uploaded", "file_ref": file_ref}


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document_alias(
    payload: DocumentUploadRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    # Demo alias for upload endpoint in OpenAPI contract.
    return await upload_document_metadata(payload=payload, current_user=current_user, db=db)


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    doc = await _fetch_authorized_document(db, current_user, doc_id)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(doc.clinic_id),
        action="document.view",
        target_type="document",
        target_id=str(doc.id),
    )
    await db.commit()

    return _serialize_doc(doc)


@router.get("/{doc_id}/download")
async def download_document_stub(
    doc_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    doc = await _fetch_authorized_document(db, current_user, doc_id)
    exp = int(time.time()) + DOWNLOAD_LINK_TTL_SEC
    sig = sign_document_file_link(doc_id=str(doc.id), expires_at_unix=exp)
    download_url = f"/api/v1/documents/{doc.id}/file?exp={exp}&sig={sig}"
    return {
        "doc_id": str(doc.id),
        "download_url": download_url,
        "expires_in_sec": DOWNLOAD_LINK_TTL_SEC,
    }


@router.get("/{doc_id}/file")
async def download_document_file(
    doc_id: str,
    exp: int = Query(..., ge=0),
    sig: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        ) from exc

    doc = await db.scalar(select(Document).where(Document.id == doc_uuid))
    if not doc or not verify_document_file_link(
        doc_id=str(doc.id),
        expires_at_unix=exp,
        signature=sig,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    path = _resolved_storage_file_path(doc.file_ref)
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"

    await log_audit(
        db,
        actor_user_id=None,
        clinic_id=str(doc.clinic_id),
        action="document.download",
        target_type="document",
        target_id=str(doc.id),
        metadata={"via": "signed_link"},
    )
    await db.commit()

    return FileResponse(
        path,
        media_type=media_type,
        filename=path.name,
        content_disposition_type="attachment",
    )


@router.delete("/{doc_id}", response_model=DocumentDeleteResponse)
async def delete_document(
    doc_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentDeleteResponse:
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid document id"},
        ) from exc

    doc = await db.scalar(select(Document).where(Document.id == doc_uuid))
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=doc.pet_id)
    elif current_user.role in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=doc.pet_id,
            clinic_id=doc.clinic_id,
            required_scope=ConsentScope.full_record,
        )
    else:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Role is not allowed"})

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(doc.clinic_id),
        action="document.delete",
        target_type="document",
        target_id=str(doc.id),
    )
    await db.delete(doc)
    await db.commit()
    return DocumentDeleteResponse(status="deleted")


@router.post("/{doc_id}/ai-explain")
async def ai_explain_document(
    doc_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid document id"},
        ) from exc

    doc = await db.scalar(select(Document).where(Document.id == doc_uuid))
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=doc.pet_id)
    else:
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=doc.pet_id,
            clinic_id=doc.clinic_id,
            required_scope=ConsentScope.full_record,
        )

    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="doc-explain",
        payload_size=len(doc.doc_type or "") + len(doc.file_ref or ""),
        metadata={"doc_id": str(doc.id), "doc_type": doc.doc_type},
        runner=lambda _execution: explain_document(doc.doc_type),
        success_metadata={"doc_id": str(doc.id), "doc_type": doc.doc_type},
        failure_message="Объяснение документа временно недоступно.",
    )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(doc.clinic_id),
        action="document.ai_explain",
        target_type="document",
        target_id=str(doc.id),
        metadata={"route_slug": governed.execution.route_slug},
    )
    await db.commit()
    return governed.result
