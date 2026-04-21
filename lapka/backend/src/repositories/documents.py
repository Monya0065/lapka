import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Document


async def get_document(db: AsyncSession, document_id: uuid.UUID) -> Document | None:
    return await db.scalar(select(Document).where(Document.id == document_id))


async def list_documents(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID | None = None,
    clinic_id: uuid.UUID | None = None,
    doc_type: str | None = None,
    created_by: uuid.UUID | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Document]:
    conditions = []
    
    if pet_id:
        conditions.append(Document.pet_id == pet_id)
    if clinic_id:
        conditions.append(Document.clinic_id == clinic_id)
    if doc_type:
        conditions.append(Document.doc_type == doc_type)
    if created_by:
        conditions.append(Document.uploaded_by == created_by)
    if from_date:
        conditions.append(Document.created_at >= from_date)
    if to_date:
        conditions.append(Document.created_at <= to_date)
    
    query = select(Document).order_by(Document.created_at.desc())
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.limit(limit).offset(offset)
    return list((await db.scalars(query)).all())


async def list_documents_for_pet(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
    doc_types: List[str] | None = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Document]:
    query = (
        select(Document)
        .where(Document.pet_id == pet_id)
        .order_by(Document.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    
    if doc_types:
        query = query.where(Document.doc_type.in_(doc_types))
    
    return list((await db.scalars(query)).all())


async def count_documents(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID | None = None,
    clinic_id: uuid.UUID | None = None,
    doc_type: str | None = None,
) -> int:
    conditions = []
    if pet_id:
        conditions.append(Document.pet_id == pet_id)
    if clinic_id:
        conditions.append(Document.clinic_id == clinic_id)
    if doc_type:
        conditions.append(Document.doc_type == doc_type)
    
    query = select(func.count(Document.id))
    if conditions:
        query = query.where(and_(*conditions))
    
    return int((await db.scalar(query)) or 0)


async def create_document(db: AsyncSession, document: Document) -> Document:
    db.add(document)
    await db.flush()
    await db.refresh(document)
    return document


async def update_document(db: AsyncSession, document: Document) -> Document:
    await db.flush()
    await db.refresh(document)
    return document


async def delete_document(db: AsyncSession, document: Document) -> None:
    await db.delete(document)
    await db.flush()


async def get_document_by_token(
    db: AsyncSession, 
    *, 
    access_token: str
) -> Document | None:
    return await db.scalar(
        select(Document).where(Document.file_ref == access_token)
    )


async def search_documents(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
    query_text: str,
    limit: int = 20,
) -> List[Document]:
    search = f"%{query_text}%"
    query = (
        select(Document)
        .where(
            and_(
                Document.pet_id == pet_id,
                Document.doc_type.ilike(search)
            )
        )
        .order_by(Document.created_at.desc())
        .limit(limit)
    )
    return list((await db.scalars(query)).all())