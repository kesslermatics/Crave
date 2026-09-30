"""Stable vocabulary used by recipe records and API payloads."""

from enum import StrEnum


class RecipeType(StrEnum):
    MEAL = "meal"
    BAKING = "baking"
    DRINK = "drink"
    BASIC = "basic"
    PRESERVING = "preserving"


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class VolumeIndex(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ServingTemperature(StrEnum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    ICED = "iced"
    CHILLED = "chilled"
    ROOM_TEMPERATURE = "room_temperature"


class OvenMode(StrEnum):
    CONVENTIONAL = "conventional"
    FAN = "fan"
    HOT_AIR = "hot_air"


class DrinkPreparationMethod(StrEnum):
    BLENDED = "blended"
    SHAKEN = "shaken"
    STIRRED = "stirred"
    BREWED = "brewed"
    STEEPED = "steeped"
    BUILT_IN_GLASS = "built_in_glass"


class IceType(StrEnum):
    NONE = "none"
    CUBES = "cubes"
    CRUSHED = "crushed"


class CaffeineLevel(StrEnum):
    NONE = "none"
    LOW = "low"
    HIGH = "high"


class StorageMethod(StrEnum):
    FRIDGE = "fridge"
    PANTRY = "pantry"
    FREEZER = "freezer"