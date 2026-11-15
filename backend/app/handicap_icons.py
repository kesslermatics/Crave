"""AI-generated handicap icons in one consistent style.

Flow: the admin generates a style sample for a single handicap (as often as needed), approves it, and then
every missing icon is generated in that style. On every backend start missing icons are filled in again."""

import asyncio
import logging
import random
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, is_admin, require_admin
from app.db import get_session, get_session_factory
from app.events import generate_image_data
from app.handicaps import CATALOG
from app.models import HandicapIconImage, User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["handicap-icons"])

ICON_SIDE = 256
ICON_CONCURRENCY = 3
_fill_lock = asyncio.Lock()

# Used only when the admin gives no own style direction.
DEFAULT_STYLE = "stylized 3D render, cartoonish, vibrant colours, soft lighting, claymation style, playful, game UI icon, clean background"
TIER_ACCENT = {"light": "golden yellow", "medium": "bright orange", "heavy": "deep red"}

# What each icon shows (English, for the image model).
MOTIFS: dict[str, str] = {
    "anagramm_nebel": "scrambled letter tiles drifting in a soft fog cloud",
    "vokal_schwund": "a word made of tiles where some tiles are crumbling and vanishing",
    "emoji_code": "a cluster of three cute round emoji faces with a small question mark bubble",
    "graustufen": "a bell pepper split vertically, one half colourful, one half black-and-white",
    "lueckentext": "a mosaic of square tiles with several tiles missing like a puzzle",
    "spiegelwelt": "a hand mirror reflecting a tomato the wrong way round",
    "einheiten_troll": "a kitchen scale with a mischievous grin and an oversized tiny weight",
    "lsd_trip": "a lemon painted in psychedelic rainbow swirls",
    "makro_zoom": "a big magnifying glass showing the textured surface of an orange peel",
    "dialekt_roulette": "a speech bubble shaped like a roulette wheel",
    "telegramm": "an old telegram slip with three short dashes and a paper plane",
    "ein_schuss": "a single dart hitting the bullseye of a target",
    "philosoph": "a thinking chef's hat with a small swirl of mist and a question mark",
    "schwarzes_loch": "a measuring cup being sucked into a swirling black hole",
    "bild_embargo": "a food photo frame that is heavily blurred with a crossed-out eye",
    "kategorien_salat": "a salad bowl full of mixed tiny recipe cards instead of leaves",
    "kuckucksei": "a strange speckled odd egg sitting among normal eggs in a nest",
    "mengen_tausch": "two measuring spoons swapping places with curved arrows",
    "proportionen": "a dinner plate surrounded by seven tiny fork and knife pairs",
    "einheiten_lotto": "a pair of dice whose faces show kitchen measuring symbols (spoon, cup, drop)",
    "geteiltes_bewusstsein": "a brain split into two glowing halves connected by a thin spark",
    "stille_post": "two tin-can telephones connected by a tangled string",
    "blindverkostung": "a chef's blindfold tied around a covered dinner cloche",
    "memory": "a kitchen timer shaped like a small brain with a ticking dial",
    "good_cop_bad_cop": "a theatre mask that is half friendly angel and half sneaky devil",
    "frankenstein": "two ingredient jars stitched together with big stitches and a lightning bolt",
    "phantom": "a cute ghost floating above an empty space on a cutting board",
    "dreifach_saboteur": "three cartoon bombs with lit fuses sitting in a mixing bowl",
    "prozente": "a pie chart made of a real pie with slices of different sizes",
    "paralleles_universum": "a casserole dish reflected in a portal as a fancy dessert",
}


class StyleRequest(BaseModel):
    handicap_id: str | None = None
    style_hint: str = Field(default="", max_length=400)


def icon_prompt(handicap_id: str, style_hint: str) -> str:
    """Subject first (what the icon must show and why), then the style. Image models weigh the beginning most,
    so a long style preamble made every icon look like the same generic badge."""
    handicap = CATALOG[handicap_id]
    return (
        f"Icon for a handicap card in a cooking party game. Handicap name (German): \"{handicap.title}\". "
        f"What it does in the game (German): {handicap.description} "
        f"The icon must clearly and literally show: {MOTIFS.get(handicap_id, handicap.title)}. "
        "This object is the hero of the picture, large, centred and instantly recognisable at small size, with one or two supporting details at most. "
        f"Style: {style_hint.strip() or DEFAULT_STYLE}. "
        f"Use a subtle {TIER_ACCENT.get(handicap.tier, 'golden yellow')} accent colour somewhere in the object or its glow to mark the difficulty. "
        "Square 1:1, plain uncluttered background. Absolutely no text, letters, numbers, labels or logos."
    )


async def approved_style(session: AsyncSession) -> str | None:
    row = await session.scalar(select(HandicapIconImage).where(HandicapIconImage.approved.is_(True), HandicapIconImage.id != "__preview__").limit(1))
    return row.style_hint if row else None


async def fill_missing_icons() -> None:
    """Generate every missing icon in the approved style. Safe to call often; one run at a time."""
    if _fill_lock.locked():
        return
    async with _fill_lock:
        factory = get_session_factory()
        async with factory() as session:
            style = await approved_style(session)
            if style is None:
                return
            existing = set((await session.scalars(select(HandicapIconImage.id).where(HandicapIconImage.approved.is_(True)))).all())
        missing = [handicap_id for handicap_id in CATALOG if handicap_id not in existing]
        if not missing:
            return
        logger.info("Generating %d handicap icons", len(missing))
        semaphore = asyncio.Semaphore(ICON_CONCURRENCY)

        async def one(handicap_id: str) -> None:
            async with semaphore:
                image = await generate_image_data(icon_prompt(handicap_id, style), ICON_SIDE)
            if image is None:
                return
            async with factory() as session:
                await session.merge(HandicapIconImage(id=handicap_id, image_data=image, approved=True, style_hint=style, source=handicap_id))
                await session.commit()

        await asyncio.gather(*(one(handicap_id) for handicap_id in missing))


PREVIEW_ID = "__preview__"


@router.get("/handicaps/icons")
async def icons(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)) -> dict[str, Any]:
    rows = (await session.scalars(select(HandicapIconImage))).all()
    approved = [row for row in rows if row.approved and row.id in CATALOG]
    result: dict[str, Any] = {"icons": {row.id: row.image_data for row in approved}}
    if is_admin(user):
        preview = next((row for row in rows if row.id == PREVIEW_ID), None)
        result.update(
            total=len(CATALOG), done=len(approved), approved=bool(approved), generating=_fill_lock.locked(),
            preview={"handicap_id": preview.source, "title": CATALOG[preview.source].title, "image_data": preview.image_data, "style_hint": preview.style_hint, "prompt": icon_prompt(preview.source, preview.style_hint)}
            if preview and preview.source in CATALOG else None,
        )
    return result


@router.post("/admin/handicap-icons/preview")
async def generate_preview(request: StyleRequest, session: AsyncSession = Depends(get_session), _: User = Depends(require_admin)) -> dict[str, Any]:
    """One sample icon for judging the style. Replaces the previous sample; approved icons stay untouched."""
    handicap_id = request.handicap_id if request.handicap_id in CATALOG else random.choice(list(CATALOG))
    style = request.style_hint.strip()
    image = await generate_image_data(icon_prompt(handicap_id, style), ICON_SIDE)
    if image is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Die Bild-KI ist gerade nicht erreichbar.")
    await session.merge(HandicapIconImage(id=PREVIEW_ID, image_data=image, approved=False, style_hint=style, source=handicap_id))
    await session.commit()
    return {"handicap_id": handicap_id, "title": CATALOG[handicap_id].title, "image_data": image, "style_hint": style, "prompt": icon_prompt(handicap_id, style)}


@router.post("/admin/handicap-icons/approve", status_code=status.HTTP_202_ACCEPTED)
async def approve_style(background: BackgroundTasks, session: AsyncSession = Depends(get_session), _: User = Depends(require_admin)) -> dict[str, str]:
    """Accept the sample's style: the sample becomes that handicap's icon and every other icon is
    (re)generated in this style in the background, so the whole set stays consistent."""
    preview = await session.get(HandicapIconImage, PREVIEW_ID)
    if preview is None or preview.source not in CATALOG:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Erst eine Stil-Probe generieren.")
    await session.execute(delete(HandicapIconImage).where(HandicapIconImage.id != PREVIEW_ID, HandicapIconImage.style_hint != preview.style_hint))
    await session.merge(HandicapIconImage(id=preview.source, image_data=preview.image_data, approved=True, style_hint=preview.style_hint, source=preview.source))
    await session.delete(preview)
    await session.commit()
    background.add_task(fill_missing_icons)
    return {"status": "generating"}
