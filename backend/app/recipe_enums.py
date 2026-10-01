"""Stable vocabulary used by recipe records and API payloads."""

from enum import StrEnum
from typing import Literal, get_args

# Supermarket sections for shopping list entries (shared by AI parsing and persistence).
ShoppingSection = Literal["produce", "chilled", "meat_fish", "bakery", "pantry", "frozen", "drinks", "other"]
SHOPPING_SECTIONS: tuple[str, ...] = get_args(ShoppingSection)


class RecipeType(StrEnum):
    MEAL = "meal"
    BAKING = "baking"
    DRINK = "drink"
    BASIC = "basic"
    PRESERVING = "preserving"


class Appliance(StrEnum):
    """Kitchen machine a recipe is written for (steps then contain machine settings like "10 Sek./Stufe 5")."""

    NONE = "none"
    THERMOMIX = "thermomix"
    MONSIEUR_CUISINE = "monsieur_cuisine"


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EINFACH = "einfach"
    MITTEL = "mittel"
    SCHWER = "schwer"


class VolumeIndex(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    GERING = "gering"
    MITTEL = "mittel"
    HOCH = "hoch"


class ServingTemperature(StrEnum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    ICED = "iced"
    CHILLED = "chilled"
    ROOM_TEMPERATURE = "room_temperature"
    HEISS = "heiss"
    KALT = "kalt"
    EISKALT = "eiskalt"
    GEKUEHLT = "gekuehlt"
    ZIMMERTEMPERATUR = "zimmertemperatur"


class OvenMode(StrEnum):
    CONVENTIONAL = "conventional"
    FAN = "fan"
    HOT_AIR = "hot_air"
    OBER_UNTERHITZE = "ober_unterhitze"
    UMLUFT = "umluft"
    HEISSLUFT = "heissluft"


class DrinkPreparationMethod(StrEnum):
    BLENDED = "blended"
    SHAKEN = "shaken"
    STIRRED = "stirred"
    BREWED = "brewed"
    STEEPED = "steeped"
    BUILT_IN_GLASS = "built_in_glass"
    PUERIERT = "pueriert"
    GESCHUETTELT = "geschuettelt"
    GERUEHRT = "geruehrt"
    GEBRUEHT = "gebrueht"
    GEZOGEN = "gezogen"
    IM_GLAS = "im_glas"


class IceType(StrEnum):
    NONE = "none"
    CUBES = "cubes"
    CRUSHED = "crushed"
    OHNE = "ohne"
    WUERFEL = "wuerfel"


class CaffeineLevel(StrEnum):
    NONE = "none"
    LOW = "low"
    HIGH = "high"
    KEIN = "kein"
    WENIG = "wenig"
    VIEL = "viel"


class StorageMethod(StrEnum):
    FRIDGE = "fridge"
    PANTRY = "pantry"
    FREEZER = "freezer"
    KUEHLSCHRANK = "kuehlschrank"
    VORRATSSCHRANK = "vorratsschrank"
    TIEFKUEHLER = "tiefkuehler"