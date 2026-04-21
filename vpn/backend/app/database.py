"""Database configuration and session management."""
import os

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://vpn:vpn@postgres:5432/vpn",
)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

_engine: AsyncEngine | None = None
_session_factory: sessionmaker | None = None


async def create_pool() -> AsyncEngine:
    global _engine, _session_factory
    _engine = create_async_engine(DATABASE_URL, echo=False)
    _session_factory = sessionmaker(
        _engine, class_=AsyncSession, expire_on_commit=False
    )
    return _engine


def create_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("Database engine not initialized")
    return _engine


async def create_session() -> AsyncSession:
    if _session_factory is None:
        raise RuntimeError("Database engine not initialized")
    return _session_factory()


async def get_session() -> AsyncSession:
    return await create_session()