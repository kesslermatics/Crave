"""Handicap catalogue: each handicap disguises exactly one ingredient of a daily drop.

Name/amount disguises are computed here at generation time, so the real ingredient name never reaches the
browser. Picture effects (blur, sepia, pixels …) are applied by the client from the handicap id."""

import json
import logging
import random
import re
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Depends
from openai import OpenAIError
from pydantic import BaseModel, Field, ValidationError

from app.ai import complete_json
from app.auth import get_current_user
from app.config import get_settings
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/handicaps", tags=["handicaps"])

VOWELS = set("aeiouäöüAEIOUÄÖÜ")
METRIC_UNITS = {"g", "gramm", "kg", "kilogramm", "ml", "milliliter", "l", "liter"}
TIERS = [("light", "Leicht"), ("medium", "Mittel"), ("heavy", "Schwer")]


@dataclass(frozen=True)
class Handicap:
    id: str
    tier: str
    cost: int
    title: str
    description: str
    ai_hint: str
    text_kind: str | None = None  # "emoji" | "synonym": the AI must supply the disguised name

    def fits(self, item: dict[str, Any]) -> bool:
        if self.id == "einheiten_troll":
            return str(item.get("unit", "")).strip().lower() in METRIC_UNITS and float(item.get("amount") or 0) > 0
        return True


HANDICAPS = [
    Handicap("anagramm_nebel", "light", 1, "Anagramm im Nebel", "Der Name ist durcheinandergewürfelt, das Bild verschwommen – Umrisse und Farben bleiben erkennbar.", "Gut bei Zutaten mit eindeutiger Form und Farbe."),
    Handicap("vokal_schwund", "light", 1, "Vokal-Schwund", "Alle Vokale fehlen im Namen, das Bild ist in Sepia getaucht.", "Gut bei längeren Namen."),
    Handicap("emoji_code", "light", 1, "Emoji-Code", "Der Name wird durch 2–3 Emojis ersetzt, das Bild ist grob verpixelt.", "Gut bei Zutaten, die sich klar mit Emojis umschreiben lassen.", "emoji"),
    Handicap("graustufen", "light", 1, "Das Graustufen-Rätsel", "Kein Name, nur „???“. Das Bild ist scharf, aber schwarz-weiß.", "Besonders fies bei Zutaten, deren Farbe zählt (Paprika, Zwiebel, Linsen)."),
    Handicap("lueckentext", "light", 1, "Lückentext & Mosaik", "Jeder zweite Buchstabe ist ein Unterstrich, das Bild ein grobes Mosaik.", "Für fast alle Zutaten geeignet."),
    Handicap("spiegelwelt", "light", 1, "Spiegelwelt", "Name und Bild sind spiegelverkehrt.", "Kurzer Hä-Moment, für jede Zutat geeignet."),
    Handicap("einheiten_troll", "light", 1, "Einheiten-Troll", "Die Menge stimmt, steht aber in einer absurden Einheit da (Kilogramm, Mikroliter …).", "Nur für Zutaten mit g, kg, ml oder l."),
    Handicap("lsd_trip", "light", 1, "Der LSD-Trip", "Leichtes Anagramm, und das Bild bekommt völlig falsche Farben.", "Lustig bei Zutaten mit typischer Farbe (Zitrone, Tomate, Brokkoli)."),
    Handicap("makro_zoom", "light", 1, "Makro-Zoom", "Der Name ist zensiert, das Bild extrem herangezoomt – nur die Textur bleibt.", "Nur für Standardzutaten mit markanter Textur (Orange, Hackfleisch, Brot, Käse)."),
    Handicap("dialekt_roulette", "light", 1, "Dialekt-Roulette", "Das Bild ist normal, aber die Zutat trägt ihren regionalsten oder altmodischsten deutschen Namen.", "Nur für Zutaten, für die es echte regionale Begriffe gibt (Tomate, Sahne, Kartoffel, Möhre, Quark).", "synonym"),
]
CATALOG = {handicap.id: handicap for handicap in HANDICAPS}


# ---------------------------------------------------------------- disguises


def _per_word(name: str, change) -> str:
    return " ".join(change(word) for word in name.split())


def _scramble(word: str, rng: random.Random) -> str:
    letters = list(word.upper())
    original = list(letters)
    if len(set(letters)) > 1:
        while letters == original:
            rng.shuffle(letters)
    return "".join(letters)


def _swap_inner(word: str, rng: random.Random) -> str:
    """A light anagram: swap one pair of inner letters, so the word is still almost readable."""
    if len(word) < 4:
        return word
    chars = list(word)
    for _ in range(6):
        i = rng.randrange(1, len(chars) - 2)
        if chars[i] != chars[i + 1]:
            chars[i], chars[i + 1] = chars[i + 1], chars[i]
            break
    return "".join(chars)


def _troll_units(amount: float, unit: str) -> tuple[float, str]:
    u = unit.strip().lower()
    if u in ("g", "gramm"):
        return (amount / 1000, "kg") if amount >= 100 else (amount * 1000, "mg")
    if u in ("kg", "kilogramm"):
        return amount * 100, "Dekagramm"
    if u in ("ml", "milliliter"):
        return amount * 1000, "Mikroliter"
    return amount * 100, "Zentiliter"


def apply_handicap(item: dict[str, Any], handicap: Handicap, text: str, rng: random.Random) -> dict[str, Any]:
    name, amount, unit = str(item["name"]), float(item["amount"]), str(item["unit"])
    match handicap.id:
        case "anagramm_nebel":
            name = _per_word(name, lambda word: _scramble(word, rng))
        case "vokal_schwund":
            name = "".join(c for c in name if c not in VOWELS).upper() or name.upper()
        case "emoji_code":
            name = text or "❓❓"
        case "graustufen":
            name = "???"
        case "lueckentext":
            name = _per_word(name, lambda word: "".join("_" if index % 2 else char for index, char in enumerate(word)))
        case "lsd_trip":
            name = _per_word(name, lambda word: _swap_inner(word, rng))
        case "makro_zoom":
            name = "▇▇▇▇▇"
        case "dialekt_roulette":
            name = text or name
        case "einheiten_troll":
            amount, unit = _troll_units(amount, unit)
    return {"display_name": name, "display_amount": round(amount, 4), "display_unit": unit, "handicap": handicap.id}


def clean_text(handicap: Handicap, text: str, real_name: str) -> str:
    text = text.strip()[:40]
    if handicap.text_kind == "emoji":
        text = re.sub(r"[\w\s.,;:!?()\"'-]", "", text)[:16]
    elif handicap.text_kind == "synonym" and text.lower() == real_name.strip().lower():
        return ""
    return text


# ---------------------------------------------------------------- choosing


class Pick(BaseModel):
    handicap: str
    ingredient: int
    text: str = ""


class Picks(BaseModel):
    picks: list[Pick] = Field(default_factory=list)


async def choose_handicaps(ingredients: list[dict[str, Any]], eligible: list[int], budget: int, recent: list[str], seed: str) -> tuple[list[dict[str, Any]], int]:
    """Spend as many penalty points as possible, one handicap per ingredient. The AI picks fitting combos
    (and varies against recent events); anything invalid is dropped and the rest is filled randomly."""
    rng = random.Random(seed)
    if budget <= 0 or not eligible:
        return [], 0
    catalogue = [{"id": h.id, "cost": h.cost, "title": h.title, "effect": h.description, "passt_zu": h.ai_hint} for h in HANDICAPS]
    listing = "\n".join(f"{i}: {ingredients[i]['name']} – {ingredients[i]['amount']:g} {ingredients[i]['unit']}" for i in eligible)
    prompt = f"""Du bist der fiese, aber faire Spielleiter eines Koch-Spiels. Die Spieler haben {budget} Strafpunkte, die du möglichst vollständig in Handicaps ausgibst (Kosten siehe Katalog). Jedes Handicap verschleiert genau eine Zutat, jede Zutat bekommt höchstens ein Handicap.
Katalog: {json.dumps(catalogue, ensure_ascii=False)}
Zutaten (Index: Name – Menge):
{listing}
Zuletzt verwendete Handicaps (sorge für Abwechslung, Wiederholungen sind aber erlaubt): {json.dumps(recent, ensure_ascii=False)}
Wähle zu jeder Zutat ein Handicap, das wirklich passt. Für "emoji_code" schreibe in text 2–3 passende Emojis ohne Buchstaben. Für "dialekt_roulette" schreibe in text den regionalsten, obskursten oder altmodischsten deutschen Begriff für die Zutat (nicht den üblichen Namen). Sonst bleibt text leer.
Antworte nur mit JSON: {{"picks":[{{"handicap":str,"ingredient":int,"text":str}}]}}"""
    try:
        suggested = Picks.model_validate(await complete_json(prompt, model=get_settings().fast_model, max_tokens=2_000)).picks
    except (OpenAIError, ValueError, ValidationError, json.JSONDecodeError):
        logger.warning("Handicap selection failed, picking randomly", exc_info=True)
        suggested = []

    chosen: list[dict[str, Any]] = []
    used: set[int] = set()
    spent = 0
    for pick in suggested:
        handicap = CATALOG.get(pick.handicap)
        if handicap is None or pick.ingredient not in eligible or pick.ingredient in used or spent + handicap.cost > budget:
            continue
        item = ingredients[pick.ingredient]
        text = clean_text(handicap, pick.text, str(item["name"])) if handicap.text_kind else ""
        if not handicap.fits(item) or (handicap.text_kind and not text):
            continue
        chosen.append({"index": pick.ingredient, "handicap": handicap.id, "text": text})
        used.add(pick.ingredient)
        spent += handicap.cost

    free = [i for i in eligible if i not in used]
    rng.shuffle(free)
    for index in free:
        options = [h for h in HANDICAPS if not h.text_kind and h.cost <= budget - spent and h.fits(ingredients[index])]
        if not options:
            break
        fresh = [h for h in options if h.id not in recent and h.id not in {c["handicap"] for c in chosen}]
        handicap = rng.choice(fresh or options)
        chosen.append({"index": index, "handicap": handicap.id, "text": ""})
        spent += handicap.cost
    return chosen, spent


def disguise(item: dict[str, Any], pick: dict[str, Any], seed: str) -> dict[str, Any]:
    return apply_handicap(item, CATALOG[pick["handicap"]], pick.get("text", ""), random.Random(seed))


def public_item(item: dict[str, Any], image_data: str | None) -> dict[str, Any]:
    """What a player may see of a revealed ingredient: the disguise if handicapped, never the image key."""
    handicap = CATALOG.get(str(item.get("handicap") or ""))
    if handicap is None:
        return {"name": item["name"], "amount": item["amount"], "unit": item["unit"], "image_data": image_data, "handicap": None}
    return {"name": item["display_name"], "amount": item["display_amount"], "unit": item["display_unit"], "image_data": image_data,
            "handicap": {"id": handicap.id, "title": handicap.title}}


# ---------------------------------------------------------------- shop

EXAMPLE = {"name": "Tomate", "amount": 200, "unit": "g"}
EXAMPLE_TEXT = {"emoji": "🍅🔴🍝", "synonym": "Paradeiser"}


@router.get("")
async def catalog(_: User = Depends(get_current_user)) -> dict[str, Any]:
    rng = random.Random(7)
    return {"tiers": [{
        "tier": tier, "label": label,
        "items": [{"id": h.id, "cost": h.cost, "title": h.title, "description": h.description,
                   "example": public_item({**EXAMPLE, **apply_handicap(EXAMPLE, h, EXAMPLE_TEXT.get(h.text_kind or "", ""), rng)}, None)}
                  for h in HANDICAPS if h.tier == tier],
    } for tier, label in TIERS]}
