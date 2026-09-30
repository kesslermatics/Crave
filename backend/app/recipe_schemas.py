"""Validation contracts for common recipe content and recipe-type details."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.recipe_enums import (
    CaffeineLevel,
    Difficulty,
    DrinkPreparationMethod,
    IceType,
    OvenMode,
    RecipeType,
    ServingTemperature,
    StorageMethod,
    VolumeIndex,
)


class Ingredient(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    amount: float = Field(ge=0, le=100_000)
    unit: str = Field(min_length=1, max_length=32)


class MealDetails(BaseModel):
    cooking_method: str = Field(min_length=1, max_length=80)
    required_equipment: list[str] = Field(default_factory=list, max_length=20)
    prep_time_minutes: int = Field(ge=0, le=1_440)
    cook_time_minutes: int = Field(ge=0, le=1_440)
    meal_prep_friendly: bool = False
    fridge_life_days: int = Field(default=0, ge=0, le=365)
    freezable: bool = False
    spiciness_level: int = Field(default=1, ge=1, le=5)
    volume_index: VolumeIndex = VolumeIndex.MEDIUM
    served_temperature: ServingTemperature = ServingTemperature.HOT


class BakingDetails(BaseModel):
    oven_temperature_c: int = Field(ge=0, le=350)
    oven_mode: OvenMode
    preheat_required: bool = True
    pan_type: str = Field(min_length=1, max_length=80)
    pan_size_cm: float = Field(gt=0, le=200)
    resting_time_minutes: int = Field(default=0, ge=0, le=10_080)
    cooling_time_minutes: int = Field(default=0, ge=0, le=10_080)
    dough_type: str = Field(min_length=1, max_length=80)
    special_techniques: list[str] = Field(default_factory=list, max_length=20)


class DrinkDetails(BaseModel):
    prep_method: DrinkPreparationMethod
    required_equipment: list[str] = Field(default_factory=list, max_length=20)
    served_temperature: ServingTemperature
    ice_type: IceType = IceType.NONE
    abv_percent: float = Field(default=0, ge=0, le=100)
    caffeine_level: CaffeineLevel = CaffeineLevel.NONE
    glass_type: str = Field(min_length=1, max_length=80)
    volume_ml: int = Field(gt=0, le=10_000)


class BasicDetails(BaseModel):
    yield_amount: float = Field(gt=0, le=100_000)
    yield_unit: str = Field(min_length=1, max_length=32)
    serving_size_amount: float = Field(gt=0, le=100_000)
    serving_size_unit: str = Field(min_length=1, max_length=32)
    storage_method: StorageMethod
    shelf_life_days: int = Field(ge=0, le=3_650)
    storage_tips: list[str] = Field(default_factory=list, max_length=20)
    component_type: str = Field(min_length=1, max_length=80)
    pairs_well_with: list[str] = Field(default_factory=list, max_length=50)
    resting_time_minutes: int = Field(default=0, ge=0, le=10_080)


class PreservingDetails(BaseModel):
    preservation_method: str = Field(min_length=1, max_length=80)
    storage_method: StorageMethod
    shelf_life_days: int = Field(ge=1, le=3_650)
    processing_time_minutes: int = Field(ge=0, le=10_080)


DETAIL_MODELS = {
    RecipeType.MEAL: MealDetails,
    RecipeType.BAKING: BakingDetails,
    RecipeType.DRINK: DrinkDetails,
    RecipeType.BASIC: BasicDetails,
    RecipeType.PRESERVING: PreservingDetails,
}


class RecipeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2_000)
    recipe_type: RecipeType
    image_data: str | None = Field(default=None, max_length=15_000_000)
    servings: int = Field(gt=0, le=100)
    total_time_minutes: int = Field(ge=0, le=10_080)
    difficulty: Difficulty
    calories: int = Field(ge=0, le=100_000)
    protein_g: float = Field(ge=0, le=10_000)
    carbs_g: float = Field(ge=0, le=10_000)
    fat_g: float = Field(ge=0, le=10_000)
    ingredients: list[Ingredient] = Field(min_length=1, max_length=100)
    instructions: list[str] = Field(min_length=1, max_length=100)
    details: dict[str, Any]
    is_ai_generated: bool = False
    tags: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validate_details_for_recipe_type(self):
        # Normalize German difficulty values to canonical DB values
        difficulty_map = {
            Difficulty.EINFACH: Difficulty.EASY,
            Difficulty.MITTEL: Difficulty.MEDIUM,
            Difficulty.SCHWER: Difficulty.HARD,
        }
        if self.difficulty in difficulty_map:
            self.difficulty = difficulty_map[self.difficulty]

        detail_model = DETAIL_MODELS[self.recipe_type]
        self.details = detail_model.model_validate(self.details).model_dump(mode="json")
        self.tags = sorted({tag.strip().lower() for tag in self.tags if tag.strip()})
        self.instructions = [step.strip() for step in self.instructions]
        if any(not step for step in self.instructions):
            raise ValueError("instructions cannot contain empty steps")
        return self


class RecipeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    recipe_type: RecipeType
    image_data: str | None
    total_time_minutes: int
    difficulty: Difficulty
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    tags: list[str]


class RecipeRead(RecipeSummary):
    servings: int
    ingredients: list[Ingredient]
    instructions: list[str]
    details: dict[str, Any]
    is_ai_generated: bool
    created_at: datetime