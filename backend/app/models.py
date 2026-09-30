"""Database models for Crave."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Table, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.recipe_enums import Difficulty, RecipeType


class Base(DeclarativeBase):
    pass


recipe_tags = Table(
    "recipe_tags",
    Base.metadata,
    Column("recipe_id", Uuid, ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Uuid, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    recipes: Mapped[list["Recipe"]] = relationship(secondary=recipe_tags, back_populates="tags")


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = (
        CheckConstraint("total_time_minutes >= 0", name="ck_recipes_total_time_nonnegative"),
        CheckConstraint("calories >= 0", name="ck_recipes_calories_nonnegative"),
        CheckConstraint("protein_g >= 0 AND carbs_g >= 0 AND fat_g >= 0", name="ck_recipes_macros_nonnegative"),
        Index("ix_recipes_type_difficulty_time", "recipe_type", "difficulty", "total_time_minutes"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recipe_type: Mapped[RecipeType] = mapped_column(Enum(RecipeType, name="recipe_type"), nullable=False, index=True)
    # image-1 output is stored as a data URL until object storage is introduced.
    image_data: Mapped[str | None] = mapped_column(Text)
    servings: Mapped[int] = mapped_column(Integer, nullable=False)
    total_time_minutes: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    difficulty: Mapped[Difficulty] = mapped_column(Enum(Difficulty, name="difficulty"), nullable=False, index=True)
    calories: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    ingredients: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False)
    instructions: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    details: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    tags: Mapped[list[Tag]] = relationship(secondary=recipe_tags, back_populates="recipes", lazy="selectin")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # New accounts require manual approval and cannot authenticate until enabled.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class RecipeSuggestionHistory(Base):
    __tablename__ = "recipe_suggestion_histories"
    __table_args__ = (Index("ix_recipe_suggestion_histories_user_updated", "user_id", "updated_at"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    iterations: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())