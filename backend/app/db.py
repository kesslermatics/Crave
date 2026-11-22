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
        # Event jury + penalty bank (events table predates these columns).
        for column in (
            "phase VARCHAR(16) NOT NULL DEFAULT 'cooking'",
            "verdict JSONB",
            "jury_error TEXT",
            "penalty_earned INTEGER NOT NULL DEFAULT 0",
            "penalty_spent INTEGER NOT NULL DEFAULT 0",
            "finished_at TIMESTAMPTZ",
            "handicaps JSONB NOT NULL DEFAULT '[]'::jsonb",
            "game_state JSONB NOT NULL DEFAULT '{}'::jsonb",
            "dish_wishes JSONB NOT NULL DEFAULT '{}'::jsonb",
        ):
            await connection.execute(text(f"ALTER TABLE events ADD COLUMN IF NOT EXISTS {column}"))
        await connection.execute(text("ALTER TABLE event_tips ADD COLUMN IF NOT EXISTS meta JSONB"))
        # Per-dish jury (the jury used to judge all dishes of an event at once).
        for column in ("jury_phase VARCHAR(16) NOT NULL DEFAULT 'cooking'", "verdict JSONB", "jury_error TEXT"):
            await connection.execute(text(f"ALTER TABLE event_recipes ADD COLUMN IF NOT EXISTS {column}"))
        # Events judged the old way: copy each dish's part of the event verdict onto the dish.
        await connection.execute(text(
            "UPDATE event_recipes r SET jury_phase = 'judged', verdict = v.elem || jsonb_build_object('reveal_at', e.verdict->'reveal_at')"
            " FROM events e, jsonb_array_elements(e.verdict->'recipes') AS v(elem)"
            " WHERE r.event_id = e.id AND e.verdict IS NOT NULL AND r.verdict IS NULL AND v.elem->>'recipe_id' = r.id::text"
        ))
        await connection.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS team_key TEXT"))
        await connection.execute(text("CREATE INDEX IF NOT EXISTS ix_events_team_key ON events (team_key)"))
        # Events from before team accounts: derive the team from the participants.
        await connection.execute(text(
            "UPDATE events e SET team_key = t.key FROM ("
            " SELECT event_id, string_agg(user_id, ',' ORDER BY user_id) AS key FROM event_participants GROUP BY event_id"
            ") t WHERE e.id = t.event_id AND e.team_key IS NULL"
        ))

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
