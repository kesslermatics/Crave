"""Validation contracts for common recipe content and recipe-type details."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.recipe_enums import (
    Appliance,
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


VOLUME_INDEX_CANONICAL: dict[str, VolumeIndex] = {
    "low": VolumeIndex.LOW, "gering": VolumeIndex.LOW,
    "medium": VolumeIndex.MEDIUM, "mittel": VolumeIndex.MEDIUM,
    "high": VolumeIndex.HIGH, "hoch": VolumeIndex.HIGH,
}

MEAL_TEMPERATURE_CANONICAL: dict[str, ServingTemperature] = {
    "hot": ServingTemperature.HOT, "heiss": ServingTemperature.HOT, "heiß": ServingTemperature.HOT,
    "warm": ServingTemperature.WARM,
    "cold": ServingTemperature.COLD, "kalt": ServingTemperature.COLD,
    "eiskalt": ServingTemperature.COLD, "iced": ServingTemperature.COLD,
    "gekuehlt": ServingTemperature.COLD, "gekühlt": ServingTemperature.COLD, "chilled": ServingTemperature.COLD,
    "zimmertemperatur": ServingTemperature.COLD, "room_temperature": ServingTemperature.COLD,
}

OVEN_MODE_CANONICAL: dict[str, OvenMode] = {
    "conventional": OvenMode.CONVENTIONAL, "ober_unterhitze": OvenMode.CONVENTIONAL,
    "fan": OvenMode.FAN, "umluft": OvenMode.FAN,
    "hot_air": OvenMode.HOT_AIR, "heissluft": OvenMode.HOT_AIR, "heißluft": OvenMode.HOT_AIR,
}

DRINK_PREP_METHOD_CANONICAL: dict[str, DrinkPreparationMethod] = {
    "blended": DrinkPreparationMethod.BLENDED, "pueriert": DrinkPreparationMethod.BLENDED, "püriert": DrinkPreparationMethod.BLENDED,
    "shaken": DrinkPreparationMethod.SHAKEN, "geschuettelt": DrinkPreparationMethod.SHAKEN, "geschüttelt": DrinkPreparationMethod.SHAKEN,
    "stirred": DrinkPreparationMethod.STIRRED, "geruehrt": DrinkPreparationMethod.STIRRED, "gerührt": DrinkPreparationMethod.STIRRED,
    "brewed": DrinkPreparationMethod.BREWED, "gebrueht": DrinkPreparationMethod.BREWED, "gebrüht": DrinkPreparationMethod.BREWED,
    "steeped": DrinkPreparationMethod.STEEPED, "gezogen": DrinkPreparationMethod.STEEPED,
    "built_in_glass": DrinkPreparationMethod.BUILT_IN_GLASS, "im_glas": DrinkPreparationMethod.BUILT_IN_GLASS,
}

DRINK_TEMPERATURE_CANONICAL: dict[str, ServingTemperature] = {
    "hot": ServingTemperature.HOT, "heiss": ServingTemperature.HOT, "heiß": ServingTemperature.HOT, "warm": ServingTemperature.HOT,
    "iced": ServingTemperature.ICED, "eiskalt": ServingTemperature.ICED,
    "chilled": ServingTemperature.CHILLED, "gekuehlt": ServingTemperature.CHILLED, "gekühlt": ServingTemperature.CHILLED,
    "cold": ServingTemperature.CHILLED, "kalt": ServingTemperature.CHILLED,
    "room_temperature": ServingTemperature.ROOM_TEMPERATURE, "zimmertemperatur": ServingTemperature.ROOM_TEMPERATURE,
}

ICE_TYPE_CANONICAL: dict[str, IceType] = {
    "none": IceType.NONE, "ohne": IceType.NONE, "kein": IceType.NONE,
    "cubes": IceType.CUBES, "wuerfel": IceType.CUBES, "würfel": IceType.CUBES, "eiswürfel": IceType.CUBES, "eiswuerfel": IceType.CUBES, "cube": IceType.CUBES,
    "crushed": IceType.CRUSHED, "crushed_ice": IceType.CRUSHED,
}

CAFFEINE_LEVEL_CANONICAL: dict[str, CaffeineLevel] = {
    "none": CaffeineLevel.NONE, "ohne": CaffeineLevel.NONE, "kein": CaffeineLevel.NONE,
    "low": CaffeineLevel.LOW, "wenig": CaffeineLevel.LOW, "gering": CaffeineLevel.LOW,
    "high": CaffeineLevel.HIGH, "viel": CaffeineLevel.HIGH, "hoch": CaffeineLevel.HIGH, "stark": CaffeineLevel.HIGH,
}

STORAGE_METHOD_CANONICAL: dict[str, StorageMethod] = {
    "fridge": StorageMethod.FRIDGE, "kuehlschrank": StorageMethod.FRIDGE, "kühlschrank": StorageMethod.FRIDGE,
    "pantry": StorageMethod.PANTRY, "vorratsschrank": StorageMethod.PANTRY,
    "freezer": StorageMethod.FREEZER, "tiefkuehler": StorageMethod.FREEZER, "tiefkühler": StorageMethod.FREEZER,
}


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

    @field_validator("volume_index", mode="before")
    @classmethod
    def canonicalize_volume_index(cls, value: Any) -> Any:
        return VOLUME_INDEX_CANONICAL.get(str(value).strip().lower(), value)

    @field_validator("served_temperature", mode="before")
    @classmethod
    def canonicalize_served_temperature(cls, value: Any) -> Any:
        return MEAL_TEMPERATURE_CANONICAL.get(str(value).strip().lower(), value)


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

    @field_validator("oven_mode", mode="before")
    @classmethod
    def canonicalize_oven_mode(cls, value: Any) -> Any:
        return OVEN_MODE_CANONICAL.get(str(value).strip().lower(), value)


class DrinkDetails(BaseModel):
    prep_method: DrinkPreparationMethod
    required_equipment: list[str] = Field(default_factory=list, max_length=20)
    served_temperature: ServingTemperature
    ice_type: IceType = IceType.NONE
    abv_percent: float = Field(default=0, ge=0, le=100)
    caffeine_level: CaffeineLevel = CaffeineLevel.NONE
    glass_type: str = Field(min_length=1, max_length=80)
    volume_ml: int = Field(gt=0, le=10_000)

    @field_validator("prep_method", mode="before")
    @classmethod
    def canonicalize_prep_method(cls, value: Any) -> Any:
        return DRINK_PREP_METHOD_CANONICAL.get(str(value).strip().lower(), value)

    @field_validator("served_temperature", mode="before")
    @classmethod
    def canonicalize_served_temperature(cls, value: Any) -> Any:
        return DRINK_TEMPERATURE_CANONICAL.get(str(value).strip().lower(), value)

    @field_validator("ice_type", mode="before")
    @classmethod
    def canonicalize_ice_type(cls, value: Any) -> Any:
        return ICE_TYPE_CANONICAL.get(str(value).strip().lower(), value)

    @field_validator("caffeine_level", mode="before")
    @classmethod
    def canonicalize_caffeine_level(cls, value: Any) -> Any:
        return CAFFEINE_LEVEL_CANONICAL.get(str(value).strip().lower(), value)

    @model_validator(mode="after")
    def refine_drink_details(self) -> "DrinkDetails":
        # If drink has ice cubes or crushed ice, it is served iced
        if self.ice_type in (IceType.CUBES, IceType.CRUSHED) and self.served_temperature in (ServingTemperature.CHILLED, ServingTemperature.ROOM_TEMPERATURE):
            self.served_temperature = ServingTemperature.ICED
        return self


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

    @field_validator("storage_method", mode="before")
    @classmethod
    def canonicalize_storage_method(cls, value: Any) -> Any:
        return STORAGE_METHOD_CANONICAL.get(str(value).strip().lower(), value)


class PreservingDetails(BaseModel):
    preservation_method: str = Field(min_length=1, max_length=80)
    storage_method: StorageMethod
    shelf_life_days: int = Field(ge=1, le=3_650)
    processing_time_minutes: int = Field(ge=0, le=10_080)

    @field_validator("storage_method", mode="before")
    @classmethod
    def canonicalize_storage_method(cls, value: Any) -> Any:
        return STORAGE_METHOD_CANONICAL.get(str(value).strip().lower(), value)


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
    appliance: Appliance = Appliance.NONE

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
    appliance: Appliance = Appliance.NONE


class RecipeRead(RecipeSummary):
    servings: int
    ingredients: list[Ingredient]
    instructions: list[str]
    details: dict[str, Any]
    is_ai_generated: bool
    created_at: datetime