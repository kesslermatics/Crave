"""Recipe persistence and filter endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.db import get_session
from app.models import Recipe, Tag, User
from app.recipe_enums import RecipeType
from app.recipe_schemas import RecipeCreate, RecipeRead, RecipeSummary

router = APIRouter(prefix="/recipes", tags=["recipes"])


def serialise_recipe(recipe: Recipe) -> RecipeRead:
    return RecipeRead(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        recipe_type=recipe.recipe_type,
        image_url=recipe.image_url,
        servings=recipe.servings,
        total_time_minutes=recipe.total_time_minutes,
        difficulty=recipe.difficulty,
        calories=recipe.calories,
        protein_g=recipe.protein_g,
        carbs_g=recipe.carbs_g,
        fat_g=recipe.fat_g,
        ingredients=recipe.ingredients,
        instructions=recipe.instructions,
        details=recipe.details,
        is_ai_generated=recipe.is_ai_generated,
        tags=[tag.name for tag in recipe.tags],
        created_at=recipe.created_at,
    )


async def resolve_tags(session: AsyncSession, names: list[str]) -> list[Tag]:
    if not names:
        return []
    existing = (await session.scalars(select(Tag).where(Tag.name.in_(names)))).all()
    by_name = {tag.name: tag for tag in existing}
    tags = list(existing)
    for name in names:
        if name not in by_name:
            tag = Tag(name=name)
            session.add(tag)
            tags.append(tag)
    return tags


@router.post("", response_model=RecipeRead, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    payload: RecipeCreate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> RecipeRead:
    """Persist a fully validated recipe and its normalized tags."""
    recipe = Recipe(
        title=payload.title,
        description=payload.description,
        recipe_type=payload.recipe_type,
        image_url=str(payload.image_url) if payload.image_url else None,
        servings=payload.servings,
        total_time_minutes=payload.total_time_minutes,
        difficulty=payload.difficulty,
        calories=payload.calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        ingredients=[ingredient.model_dump(mode="json") for ingredient in payload.ingredients],
        instructions=payload.instructions,
        details=payload.details,
        is_ai_generated=payload.is_ai_generated,
        tags=await resolve_tags(session, payload.tags),
    )
    session.add(recipe)
    await session.commit()
    await session.refresh(recipe, attribute_names=["tags"])
    return serialise_recipe(recipe)


@router.get("", response_model=list[RecipeSummary])
async def list_recipes(
    recipe_type: RecipeType | None = None,
    max_time_minutes: Annotated[int | None, Query(ge=0, le=10_080)] = None,
    min_protein_g: Annotated[float | None, Query(ge=0, le=10_000)] = None,
    tag: str | None = Query(default=None, min_length=1, max_length=80),
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> list[RecipeSummary]:
    """List recipes using indexed time, macro, type, and tag filters."""
    statement = select(Recipe).options(selectinload(Recipe.tags)).order_by(Recipe.created_at.desc()).limit(limit)
    if recipe_type is not None:
        statement = statement.where(Recipe.recipe_type == recipe_type)
    if max_time_minutes is not None:
        statement = statement.where(Recipe.total_time_minutes <= max_time_minutes)
    if min_protein_g is not None:
        statement = statement.where(Recipe.protein_g >= min_protein_g)
    if tag is not None:
        statement = statement.join(Recipe.tags).where(Tag.name == tag.strip().lower())

    recipes = (await session.scalars(statement)).unique().all()
    return [RecipeSummary(**serialise_recipe(recipe).model_dump()) for recipe in recipes]


@router.get("/{recipe_id}", response_model=RecipeRead)
async def get_recipe(
    recipe_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> RecipeRead:
    statement = select(Recipe).options(selectinload(Recipe.tags)).where(Recipe.id == recipe_id)
    recipe = await session.scalar(statement)
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="recipe not found")
    return serialise_recipe(recipe)