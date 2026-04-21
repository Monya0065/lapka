"""File upload router for WireGuard configs."""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.services import auth_service

router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/tmp/uploads"))
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

ALLOWED_EXTENSIONS = {".conf", ".zip"}
MAX_FILE_SIZE = 10 * 1024 * 1024


@router.post("/config/upload")
async def upload_config(
    file: UploadFile = File(...),
    user_id=Depends(auth_service.get_current_user_id),
):
    """Upload WireGuard config."""
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    
    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}{extension}"
    
    content = await file.read()
    
    if b"PrivateKey" not in content and b"PublicKey" not in content:
        raise HTTPException(status_code=400, detail="Invalid config file")
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    from sqlalchemy import text
    from app.database import get_session
    
    session = await get_session()
    await session.execute(
        text("""
            INSERT INTO uploaded_configs (id, user_id, filename, created_at)
            VALUES (:id, :user_id, :filename, NOW())
        """),
        {"id": file_id, "user_id": str(user_id), "filename": file.filename}
    )
    await session.commit()
    
    return {"file_id": file_id, "filename": file.filename}


@router.get("/config/{file_id}")
async def download_config(
    file_id: str,
    user_id=Depends(auth_service.get_current_user_id),
):
    """Download WireGuard config."""
    from sqlalchemy import text
    from app.database import get_session
    
    session = await get_session()
    result = await session.execute(
        text("SELECT filename FROM uploaded_configs WHERE id = :id AND user_id = :user_id"),
        {"id": file_id, "user_id": str(user_id)}
    )
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Config not found")
    
    filename = row.filename
    file_path = UPLOAD_DIR / f"{file_id}{Path(filename).suffix}"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        file_path,
        filename=filename,
        media_type="application/octet-stream",
    )


@router.delete("/config/{file_id}")
async def delete_config(
    file_id: str,
    user_id=Depends(auth_service.get_current_user_id),
):
    """Delete WireGuard config."""
    from sqlalchemy import text
    from app.database import get_session
    
    session = await get_session()
    result = await session.execute(
        text("DELETE FROM uploaded_configs WHERE id = :id AND user_id = :user_id RETURNING filename"),
        {"id": file_id, "user_id": str(user_id)}
    )
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Config not found")
    
    file_path = UPLOAD_DIR / f"{file_id}{Path(row.filename).suffix}"
    if file_path.exists():
        file_path.unlink()
    
    await session.commit()
    
    return {"deleted": True}