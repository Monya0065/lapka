"""Pagination schemas."""
from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel, Field


T = TypeVar("T")


class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = Field(default=1, ge=1, description="Page number")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper."""
    items: List[T]
    total: int
    page: int
    limit: int
    pages: int


class CursorParams(BaseModel):
    """Cursor-based pagination parameters."""
    cursor: Optional[str] = Field(default=None, description="Pagination cursor")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page")


class CursorPaginatedResponse(BaseModel, Generic[T]):
    """Cursor-based pagination response."""
    items: List[T]
    next_cursor: Optional[str]
    has_more: bool


def paginate(items: list, page: int, limit: int) -> PaginatedResponse:
    """Paginate a list of items."""
    total = len(items)
    pages = (total + limit - 1) // limit
    
    start = (page - 1) * limit
    end = start + limit
    
    return PaginatedResponse(
        items=items[start:end],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


def paginate_query(total: int, page: int, limit: int) -> dict:
    """Calculate pagination for database query."""
    offset = (page - 1) * limit
    pages = (total + limit - 1) // limit
    
    return {
        "offset": offset,
        "limit": limit,
        "page": page,
        "pages": pages,
        "total": total,
    }