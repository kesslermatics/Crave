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
        # Kitchen-machine flag (Thermomix / Monsieur Cuisine); existing recipes default to "none".
        await connection.execute(text("ALTER TABLE recipes ADD COLUMN IF NOT EXISTS appliance VARCHAR(20) NOT NULL DEFAULT 'none'"))
        # Recipe ownership; existing rows stay unowned (and hidden) until assigned via app.admin.
        await connection.execute(text("ALTER TABLE recipes ADD COLUMN IF NOT EXISTS owner_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE"))
        await connection.execute(text("CREATE INDEX IF NOT EXISTS ix_recipes_owner_id ON recipes (owner_id)"))
        # Downscaled preview for list views; backfilled below for rows that predate it.
        await connection.execute(text("ALTER TABLE recipes ADD COLUMN IF NOT EXISTS thumbnail_data TEXT"))

    await backfill_thumbnails()


async def backfill_thumbnails() -> None:
    """Generate thumbnails for recipes that have an image but no thumbnail yet (one-off after the migration)."""
    import asyncio

    from sqlalchemy import select, update

    from app.models import Recipe
    from app.thumbnails import make_thumbnail

    async with get_session_factory()() as session:
        pending = (await session.execute(select(Recipe.id).where(Recipe.image_data.is_not(None), Recipe.thumbnail_data.is_(None)))).scalars().all()
        for recipe_id in pending:
            image_data = await session.scalar(select(Recipe.image_data).where(Recipe.id == recipe_id))
            thumbnail = await asyncio.to_thread(make_thumbnail, image_data)
            if thumbnail is not None:
                await session.execute(update(Recipe).where(Recipe.id == recipe_id).values(thumbnail_data=thumbnail))
                await session.commit()
