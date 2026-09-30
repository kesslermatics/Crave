"""Lazy async Postgres engine configured from DATABASE_URL."""

from functools import lru_cache

from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    url = get_settings().sqlalchemy_database_url
    if url is None:
        raise RuntimeError("DATABASE_URL is not set")
    return create_async_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with get_session_factory()() as session:
        yield session


async def initialize_database() -> None:
    """Create the initial schema; use migration tooling before schema changes."""
    from app.models import Base

    async with get_engine().begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        # Transitional migration for databases created before generated images
        # replaced user-supplied image URLs. Use Alembic for future migrations.
        from sqlalchemy import text

        await connection.execute(text("ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_data TEXT"))
