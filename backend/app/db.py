"""Lazy async Postgres engine configured from DATABASE_URL."""

from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    url = get_settings().sqlalchemy_database_url
    if url is None:
        raise RuntimeError("DATABASE_URL is not set")
    return create_async_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)
