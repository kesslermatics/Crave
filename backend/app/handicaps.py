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
    scope: str = "ingredient"  # "ingredient": disguises one drop item; "event": changes the whole game
    example_text: str = ""

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
MEDIUM = [
    Handicap("telegramm", "medium", 3, "Der Telegramm-Stil", "Der Tipp-Chat antwortet mit höchstens 3 Wörtern. Kein Wort mehr.", "", scope="event", example_text="„Gemüse zuerst anbraten.“"),
    Handicap("ein_schuss", "medium", 3, "Der Ein-Schuss-Joker", "Die KI antwortet ausführlich – aber nach genau einer Frage ist der Chat für immer zu.", "", scope="event", example_text="Eine Frage. Wählt weise."),
    Handicap("philosoph", "medium", 3, "Der Küchen-Philosoph", "Der Tipp-Chat antwortet nur in Metaphern und kleinen Rätseln.", "", scope="event", example_text="„Weich wie ein Ohrläppchen, klebt nicht wie ein ungewollter Gast.“"),
    Handicap("schwarzes_loch", "medium", 3, "Das schwarze Loch", "Bei jedem Spieler fehlt bei genau einer wichtigen Zutat die Mengenangabe – auch am Kochtag.", "", scope="event", example_text="Butter · ? g"),
    Handicap("bild_embargo", "medium", 3, "Verschwommenes Ziel", "Das Bild des fertigen Gerichts ist am Kochtag extrem verschwommen.", "", scope="event", example_text="Suppe? Auflauf? Pfanne?"),
    Handicap("kategorien_salat", "medium", 3, "Kategorien-Salat", "Bei mehreren Gerichten stehen alle Zutaten in einer gemischten Liste – wohin gehört was?", "", scope="event", example_text="Sahne: Soße oder Teig?"),
    Handicap("kuckucksei", "medium", 3, "Das Kuckucksei", "Eine Zutat passt zum Thema, ruiniert aber das Gericht. Erkennt die Falle und lasst sie weg.", "", scope="event", example_text="Rosinen im herzhaften Gratin?"),
    Handicap("mengen_tausch", "medium", 3, "Der Mengen-Tausch", "Bei zwei sehr unterschiedlichen Zutaten sind die Mengen vertauscht.", "", scope="event", example_text="500 g Salz · 15 g Nudeln"),
    Handicap("proportionen", "medium", 3, "Proportionen-Wahnsinn", "Alle Mengen sind für eine krumme Personenzahl (z. B. 7) berechnet. Rechnet selbst runter.", "", scope="event", example_text="Für 7 Personen"),
    Handicap("einheiten_lotto", "medium", 3, "Einheiten-Lotto", "Die Zahlen stimmen, aber die Einheiten sind wild unter den Zutaten vertauscht.", "", scope="event", example_text="200 TL Mehl · 2 ml Eier"),
]
HEAVY = [
    Handicap("geteiltes_bewusstsein", "heavy", 5, "Das geteilte Bewusstsein", "Am Kochtag sieht ein Teil von euch nur die Namen, der andere nur Bilder und Mengen. Redet miteinander!", "", scope="event", example_text="„200 g weißes Pulver?“ – „Mehl oder Puderzucker?“"),
    Handicap("stille_post", "heavy", 5, "Stille Post im Chat", "Nur ein Spieler darf die KI fragen – die Antwort sehen nur die anderen.", "", scope="event", example_text="Fragen hier, Antworten dort."),
    Handicap("blindverkostung", "heavy", 5, "Die absolute Blindverkostung", "Titel und Bild bleiben am Kochtag gesperrt. Der Reveal kommt erst nach dem Kochen, direkt vor der Jury.", "", scope="event", example_text="Geheimes Gericht · ▇▇▇"),
    Handicap("memory", "heavy", 5, "Der Memory-Modus", "Nach „Kochen starten“ sind alle Zutaten 3 Minuten sichtbar – dann verschwinden Namen und Mengen.", "", scope="event", example_text="⏱ 3:00 – merkt euch alles."),
    Handicap("good_cop_bad_cop", "heavy", 5, "Good Cop, Bad Cop", "Jede Chat-Frage bekommt zwei Antworten: eine wahr, eine plausible Lüge.", "", scope="event", example_text="1) Eier trennen. 2) Eier im Ganzen."),
    Handicap("frankenstein", "heavy", 5, "Die Frankenstein-Mengen", "Am Kochtag sind 2–3 Zutatenpaare zu einem Gemisch mit Gesamtmenge verschmolzen.", "", scope="event", example_text="300 g Mehl-Wasser-Gemisch"),
    Handicap("phantom", "heavy", 5, "Das Phantom", "Die wichtigste Hauptzutat fehlt am Kochtag komplett in der Liste. Ihr habt sie gekauft – erinnert euch!", "", scope="event", example_text="Soße, Gewürze, Beilage … und?"),
    Handicap("dreifach_saboteur", "heavy", 5, "Der Dreifach-Saboteur", "Drei plausible, aber falsche Zutaten stehen auf der Liste. Sortiert genau drei aus.", "", scope="event", example_text="Tribal Council: 3 müssen gehen."),
    Handicap("prozente", "heavy", 5, "Prozentuale Kryptographie", "Gewichts- und Volumenangaben stehen am Kochtag nur als Prozent der Gesamtmenge da.", "", scope="event", example_text="Kartoffeln 80 % · Salz 1,5 %"),
    Handicap("paralleles_universum", "heavy", 5, "Das parallele Universum", "Das Bild des Gerichts lügt: Es zeigt die Zutaten im völlig falschen Stil (z. B. Auflauf als Dessert).", "", scope="event", example_text="Sieht süß aus. Ist es aber nicht."),
]
CATALOG = {handicap.id: handicap for handicap in HANDICAPS + MEDIUM + HEAVY}
TIP_STYLES = {"telegramm", "philosoph"}  # mutually exclusive: both rewrite every answer
# Handicaps that would cancel or waste each other: at most one per group.
EXCLUSIVE = [TIP_STYLES, {"blindverkostung", "paralleles_universum", "bild_embargo"}, {"prozente", "proportionen"}]
VIEW_ONLY = {"telegramm", "ein_schuss", "philosoph", "bild_embargo", "kategorien_salat", "schwarzes_loch",
             "geteiltes_bewusstsein", "stille_post", "blindverkostung", "memory", "good_cop_bad_cop", "frankenstein", "phantom", "prozente", "paralleles_universum"}


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
    catalogue = [{"id": h.id, "cost": h.cost, "title": h.title, "effect": h.description, "passt_zu": h.ai_hint} for h in HANDICAPS]  # light tier only
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
        if handicap is None or handicap.scope != "ingredient" or pick.ingredient not in eligible or pick.ingredient in used or spent + handicap.cost > budget:
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
    if handicap is not None and handicap.id == "schwarzes_loch":
        return {"name": item["name"], "amount": None, "unit": item["unit"], "image_data": image_data, "handicap": {"id": handicap.id, "title": handicap.title}}
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
        "items": [{"id": h.id, "cost": h.cost, "title": h.title, "description": h.description, "example_text": h.example_text,
                   "example": public_item({**EXAMPLE, **apply_handicap(EXAMPLE, h, EXAMPLE_TEXT.get(h.text_kind or "", ""), rng)}, None) if h.scope == "ingredient" else None}
                  for h in HANDICAPS + MEDIUM + HEAVY if h.tier == tier],
    } for tier, label in TIERS]}


# ---------------------------------------------------------------- event-wide (medium) handicaps


def plan_event_handicaps(budget: int, recipe_count: int, ingredient_count: int, recent: list[str], seed: str) -> list[str]:
    """Pick event-wide handicaps (3 or 5 points). A random share stays for the light tier (1 point per ingredient),
    the rest goes into medium/heavy ones; fresh ones first, never two from the same exclusive group."""
    rng = random.Random(f"{seed}-event")
    light_share = min(ingredient_count, rng.randint(0, max(0, budget // 3)))
    remaining = budget - light_share
    options = [h for h in MEDIUM + HEAVY if h.id != "kategorien_salat" or recipe_count > 1]
    rng.shuffle(options)
    options.sort(key=lambda h: h.id in recent)  # fresh first, otherwise random
    chosen: list[str] = []
    for handicap in options:
        if handicap.cost > remaining:
            continue
        if any(handicap.id in group and group & set(chosen) for group in EXCLUSIVE):
            continue
        chosen.append(handicap.id)
        remaining -= handicap.cost
    return chosen


class Decoy(BaseModel):
    recipe_index: int
    name: str = Field(min_length=1, max_length=80)
    amount: float = Field(gt=0, le=10_000)
    unit: str = Field(min_length=1, max_length=20)


def _nice(amount: float, unit: str) -> float:
    if unit.strip().lower() in METRIC_UNITS:
        step = 5 if amount >= 50 else 1
        return max(step, round(amount / step) * step)
    return max(0.5, round(amount * 2) / 2)


class Decoys(BaseModel):
    decoys: list[Decoy] = Field(default_factory=list)


async def _add_decoys(recipes: list[dict[str, Any]], display: list[dict[str, Any]], theme: str, count: int) -> list[tuple[int, str]]:
    """Red herrings: plausible-looking ingredients that would ruin the dish. Recorded in recipe["decoys"] for the jury."""
    dishes = json.dumps([{"index": i, "title": r["title"], "ingredients": [x["name"] for x in d["ingredients"]]} for i, (r, d) in enumerate(zip(recipes, display))], ensure_ascii=False)
    prompt = f"""Kochspiel zum Thema "{theme}". Gerichte: {dishes}
Erfinde genau {count} "Kuckuckseier": Zutaten, die zum Thema und Geschmacksprofil zu passen scheinen, das Gericht aber in Geschmack, Konsistenz oder Struktur ruinieren würden oder völlig deplatziert sind (z. B. Koriander in italienischer Pasta, Rosinen im herzhaften Gratin, Gelatine im Rührteig). Keine davon darf schon in der Liste stehen. Gib plausible Mengen an.
Antworte nur mit JSON: {{"decoys":[{{"recipe_index":int,"name":str,"amount":float,"unit":str}}]}}"""
    try:
        decoys = Decoys.model_validate(await complete_json(prompt, model=get_settings().fast_model, max_tokens=500)).decoys
    except (OpenAIError, ValueError, ValidationError, json.JSONDecodeError):
        logger.warning("Decoy ingredients failed", exc_info=True)
        return []
    added: list[tuple[int, str]] = []
    for decoy in decoys[:count]:
        if not 0 <= decoy.recipe_index < len(display):
            continue
        if decoy.name.lower() in {i["name"].lower() for i in display[decoy.recipe_index]["ingredients"]}:
            continue
        display[decoy.recipe_index]["ingredients"].append({"name": decoy.name, "amount": decoy.amount, "unit": decoy.unit})
        recipes[decoy.recipe_index].setdefault("decoys", []).append(decoy.name)
        added.append((decoy.recipe_index, decoy.name))
    return added


async def build_display(recipes: list[dict[str, Any]], ids: list[str], theme: str, seed: str) -> tuple[list[dict[str, Any]], list[str], dict[str, str]]:
    """Return per-recipe {servings, ingredients} as the players will see them, the handicaps that could actually
    be applied, and a short secret detail per handicap (revealed after the event)."""
    rng = random.Random(f"{seed}-display")
    display = [{"servings": r["servings"], "ingredients": [dict(i) for i in r["ingredients"]]} for r in recipes]
    applied: list[str] = []
    details: dict[str, str] = {}

    for handicap_id, count in (("kuckucksei", 1), ("dreifach_saboteur", 3)):
        if handicap_id not in ids:
            continue
        added = await _add_decoys(recipes, display, theme, count)
        if added:
            applied.append(handicap_id)
            details[handicap_id] = "Falsche Zutaten: " + ", ".join(f"{name} (in „{recipes[index]['title']}“)" for index, name in added)

    if "proportionen" in ids:
        targets = []
        for entry in display:
            target = 9 if entry["servings"] == 7 else 7
            factor = target / max(1, entry["servings"])
            for item in entry["ingredients"]:
                item["amount"] = _nice(float(item["amount"]) * factor, item["unit"])
            entry["servings"] = target
            targets.append(str(target))
        applied.append("proportionen")
        details["proportionen"] = f"Berechnet für {', '.join(targets)} Personen statt der Originalportionen."

    if "mengen_tausch" in ids:
        best: tuple[float, int, int, int] | None = None
        for r, entry in enumerate(display):
            items = entry["ingredients"]
            for a in range(len(items)):
                for b in range(a + 1, len(items)):
                    x, y = float(items[a]["amount"]), float(items[b]["amount"])
                    if x <= 0 or y <= 0:
                        continue
                    same_unit = items[a]["unit"].strip().lower() == items[b]["unit"].strip().lower()
                    score = max(x, y) / min(x, y) * (10 if same_unit else 1)
                    if best is None or score > best[0]:
                        best = (score, r, a, b)
        if best and best[0] >= 5:
            _, r, a, b = best
            items = display[r]["ingredients"]
            items[a]["amount"], items[b]["amount"] = items[b]["amount"], items[a]["amount"]
            applied.append("mengen_tausch")
            details["mengen_tausch"] = f"Die Mengen von {items[a]['name']} und {items[b]['name']} waren vertauscht."

    if "einheiten_lotto" in ids:
        for entry in display:
            items = entry["ingredients"]
            units = [i["unit"] for i in items]
            if len(set(units)) < 2:
                continue
            shuffled = list(units)
            for _ in range(20):
                rng.shuffle(shuffled)
                if sum(a != b for a, b in zip(units, shuffled)) >= len(units) // 2:
                    break
            for item, unit in zip(items, shuffled):
                item["unit"] = unit
        if any(len({i["unit"] for i in e["ingredients"]}) > 1 for e in display):
            applied.append("einheiten_lotto")
            details["einheiten_lotto"] = "Die Einheiten waren unter den Zutaten gemischt."

    for handicap_id in ids:  # no ingredient changes needed (applied in UI, tips, on the cook day or for images)
        if handicap_id in VIEW_ONLY:
            applied.append(handicap_id)
    for index, entry in enumerate(display):  # pre-compute the secret notes of the cook-day transformations
        _, notes = cook_view(entry["ingredients"], set(applied), f"{seed}-{index}")
        for key, note in notes.items():
            details[key] = f"{details[key]} {note}" if key in details else note
    return display, applied, details


def _weight(item: dict[str, Any]) -> float | None:
    unit = str(item.get("unit", "")).strip().lower()
    amount = item.get("amount")
    if amount is None or unit not in METRIC_UNITS:
        return None
    return float(amount) * (1000 if unit in ("kg", "kilogramm", "l", "liter") else 1)


def cook_view(items: list[dict[str, Any]], effects: set[str], seed: str) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Cook-day transformations of one dish's ingredient list (deterministic per seed). Returns the list and
    secret notes for the final reveal."""
    rng = random.Random(f"{seed}-cook")
    items = [dict(item) for item in items]
    notes: dict[str, str] = {}
    if "phantom" in effects and len(items) > 2:
        star = max(range(len(items)), key=lambda i: (_weight(items[i]) or 0, float(items[i].get("amount") or 0)))
        notes["phantom"] = f"Das Phantom: {items[star]['name']}."
        items.pop(star)
    if "frankenstein" in effects and len(items) >= 4:
        order = list(range(len(items)))
        rng.shuffle(order)
        groups: list[tuple[int, int]] = []
        used: set[int] = set()
        for a in order:  # pair up ingredients that share a unit family (g/ml or count units)
            if a in used:
                continue
            for b in order:
                if b == a or b in used:
                    continue
                if (_weight(items[a]) is None) == (_weight(items[b]) is None):
                    groups.append((a, b)); used |= {a, b}
                    break
            if len(groups) == min(3, max(2, len(items) // 4)):
                break
        fused = []
        for a, b in groups:
            first, second = items[a], items[b]
            amount = (_weight(first) or float(first.get("amount") or 0)) + (_weight(second) or float(second.get("amount") or 0)) if None not in (first.get("amount"), second.get("amount")) else None
            unit = "g" if _weight(first) is not None else first["unit"]
            fused.append({"name": f"{first['name']}-{second['name']}-Gemisch", "amount": round(amount, 2) if amount is not None else None, "unit": unit})
        if groups:
            notes["frankenstein"] = "Verschmolzen: " + ", ".join(f"{items[a]['name']} ({items[a]['amount']} {items[a]['unit']}) + {items[b]['name']} ({items[b]['amount']} {items[b]['unit']})" for a, b in groups) + "."
            items = [item for i, item in enumerate(items) if i not in used] + fused
            rng.shuffle(items)
    if "prozente" in effects:
        weights = [_weight(item) for item in items]
        total = sum(w for w in weights if w)
        if total > 0:
            for item, weight in zip(items, weights):
                if weight is not None:
                    item["amount"], item["unit"] = round(weight / total * 100, 1), "%"
    return items, notes


def black_hole_pick(indices: list[int], ingredients: list[dict[str, Any]], taken: set[int]) -> int | None:
    """The most important ingredient of one player's share: weighed ones first, then the biggest amount."""
    candidates = [i for i in indices if i not in taken and float(ingredients[i]["amount"] or 0) > 0]
    if not candidates:
        return None
    return max(candidates, key=lambda i: (ingredients[i]["unit"].strip().lower() in METRIC_UNITS, float(ingredients[i]["amount"])))


def tip_rules(effects: set[str]) -> tuple[str, int, bool]:
    """Prompt rule, token budget and whether the one-hint check runs, depending on the tip handicaps."""
    if "telegramm" in effects:
        return "Antworte mit HÖCHSTENS 3 Wörtern. Kein Wort mehr, kein Satzzeichen-Trick.", 40, False
    if "philosoph" in effects:
        return "Antworte NICHT direkt, sondern ausschließlich in einer Metapher oder einem kleinen Rätsel (höchstens 2 Sätze), das den Hinweis verschlüsselt enthält.", 300, True
    if "ein_schuss" in effects:
        return "Dies ist die einzige Frage, die die Spieler stellen dürfen: Antworte ausführlich und hilfreich (bis 6 Sätze), aber ohne vollständige Schrittliste.", 700, False
    return "Gib GENAU EINEN kurzen, hilfreichen Tipp (höchstens 2 Sätze).", 300, True


def three_words(text: str) -> str:
    return " ".join(text.split()[:3])


class TwoTips(BaseModel):
    truth: str = Field(min_length=1, max_length=1_500)
    lie: str = Field(min_length=1, max_length=1_500)


GOOD_COP_RULE = ('Erzeuge ZWEI Antworten im gleichen Stil und gleicher Länge: "truth" ist korrekt und hilfreich, '
                 '"lie" ist hochplausibel, aber falsch (würde das Gericht verschlechtern). Antworte nur mit JSON: {"truth": str, "lie": str}')
