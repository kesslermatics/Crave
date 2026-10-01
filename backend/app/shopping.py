"""Per-user shopping list persistence.

The browser keeps the list locally for instant, offline-capable interaction and
sends batched changes here. Every operation is idempotent (client-generated IDs),
so retries after a dropped connection are safe.
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_session
from app.models import ShoppingListItem, User
from app.recipe_enums import ShoppingSection

router = APIRouter(prefix="/shopping-list", tags=["shopping-list"])

MAX_ITEMS_PER_USER = 500


class ShoppingItemPayload(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    amount: float | None = Field(default=None, ge=0, le=100_000)
    unit: str = Field(default="", max_length=32)
    section: ShoppingSection
    sources: list[str] = Field(default_factory=list, max_length=20)
    added_at: datetime

    @field_validator("name", "unit")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("sources")
    @classmethod
    def tidy_sources(cls, sources: list[str]) -> list[str]:
        return list(dict.fromkeys(source.strip()[:200] for source in sources if source.strip()))

    @field_validator("added_at")
    @classmethod
    def clamp_added_at(cls, value: datetime) -> datetime:
        # Never trust client clocks to be in the future; keep ordering sane.
        value = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return min(value, datetime.now(timezone.utc))


class ShoppingItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    amount: float | None
    unit: str
    section: ShoppingSection
    sources: list[str]
    added_at: datetime


class ShoppingSyncRequest(BaseModel):
    upserts: list[ShoppingItemPayload] = Field(default_factory=list, max_length=200)
    deletes: list[UUID] = Field(default_factory=list, max_length=500)


async def list_items(session: AsyncSession, user: User) -> list[ShoppingItemRead]:
    rows = await session.scalars(
        select(ShoppingListItem).where(ShoppingListItem.user_id == user.id).order_by(ShoppingListItem.added_at, ShoppingListItem.id)
    )
    return [ShoppingItemRead.model_validate(row) for row in rows]


@router.get("", response_model=list[ShoppingItemRead])
async def get_shopping_list(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[ShoppingItemRead]:
    return await list_items(session, user)


@router.post("/sync", response_model=list[ShoppingItemRead])
async def sync_shopping_list(
    request: ShoppingSyncRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[ShoppingItemRead]:
    """Apply a batch of upserts and deletes, then return the user's full list."""
    if request.deletes:
        await session.execute(
            delete(ShoppingListItem).where(ShoppingListItem.user_id == user.id, ShoppingListItem.id.in_(request.deletes))
        )

    deleted = set(request.deletes)
    upserts = [item for item in request.upserts if item.id not in deleted]
    if upserts:
        # Generous cap against runaway clients: updates always pass, new rows only while below the limit.
        existing_count = await session.scalar(select(func.count()).select_from(ShoppingListItem).where(ShoppingListItem.user_id == user.id)) or 0
        existing_ids = set(await session.scalars(
            select(ShoppingListItem.id).where(ShoppingListItem.user_id == user.id, ShoppingListItem.id.in_([item.id for item in upserts]))
        ))
        new_items = [item for item in upserts if item.id not in existing_ids][: max(0, MAX_ITEMS_PER_USER - existing_count)]
        upserts = [item for item in upserts if item.id in existing_ids] + new_items
    if upserts:
        statement = insert(ShoppingListItem).values([
            {**item.model_dump(), "user_id": user.id} for item in upserts
        ])
        statement = statement.on_conflict_do_update(
            index_elements=[ShoppingListItem.id],
            set_={
                "name": statement.excluded.name,
                "amount": statement.excluded.amount,
                "unit": statement.excluded.unit,
                "section": statement.excluded.section,
                "sources": statement.excluded.sources,
                "updated_at": func.now(),
            },
            # An ID belonging to another user is silently ignored instead of being overwritten.
            where=ShoppingListItem.user_id == user.id,
        )
        await session.execute(statement)

    await session.commit()
    return await list_items(session, user)
