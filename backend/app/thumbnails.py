"""Small JPEG previews of recipe images, so list views don't have to ship the full-size photos."""

import base64
import binascii
import io
import logging

from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

THUMBNAIL_MAX_SIDE = 640  # cards are at most ~380 CSS px wide; this stays sharp on 2x displays
THUMBNAIL_QUALITY = 78
# Refuse decompression bombs: errors out above this pixel count instead of only warning.
Image.MAX_IMAGE_PIXELS = 50_000_000


def make_thumbnail(image_data: str | None, max_side: int = THUMBNAIL_MAX_SIDE) -> str | None:
    """Return a downscaled JPEG data URL for a stored image data URL, or None if it can't be decoded."""
    if not image_data or not image_data.startswith("data:image/"):
        return None
    try:
        encoded = image_data.split(",", 1)[1]
        with Image.open(io.BytesIO(base64.b64decode(encoded, validate=True))) as source:
            image = ImageOps.exif_transpose(source)
            image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            if image.mode != "RGB":
                image = image.convert("RGB")
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=THUMBNAIL_QUALITY, optimize=True)
    except (IndexError, binascii.Error, UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        logger.warning("Thumbnail generation failed", exc_info=True)
        return None
    return f"data:image/jpeg;base64,{base64.b64encode(buffer.getvalue()).decode('ascii')}"
