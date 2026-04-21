import io
from typing import Any

import httpx
from PIL import Image

from src.core.celery_app import celery_app


@celery_app.task(name="src.tasks.images.resize_image")
def resize_image(image_url: str, max_width: int = 1920, max_height: int = 1080) -> dict[str, Any]:
    """Resize image to fit within max dimensions."""
    try:
        response = httpx.get(image_url, timeout=30)
        response.raise_for_status()

        img = Image.open(io.BytesIO(response.content))

        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

        output = io.BytesIO()
        img.save(output, format=img.format or "JPEG", quality=85)
        output.seek(0)

        return {
            "original_url": image_url,
            "resized": True,
            "size_bytes": len(output.getvalue())
        }
    except Exception as e:
        return {"original_url": image_url, "error": str(e), "resized": False}


@celery_app.task(name="src.tasks.images.generate_thumbnail")
def generate_thumbnail(image_url: str, size: tuple[int, int] = (300, 300)) -> dict[str, Any]:
    """Generate square thumbnail from image."""
    try:
        response = httpx.get(image_url, timeout=30)
        response.raise_for_status()

        img = Image.open(io.BytesIO(response.content))

        img.thumbnail(size, Image.Resampling.LANCZOS)

        output = io.BytesIO()
        img.save(output, format="JPEG", quality=80)
        output.seek(0)

        return {
            "original_url": image_url,
            "thumbnail_generated": True,
            "size_bytes": len(output.getvalue())
        }
    except Exception as e:
        return {"original_url": image_url, "error": str(e), "thumbnail_generated": False}


@celery_app.task(name="src.tasks.images.extract_exif")
def extract_exif(image_url: str) -> dict[str, Any]:
    """Extract EXIF data from image (for geolocation)."""
    try:
        response = httpx.get(image_url, timeout=30)
        response.raise_for_status()

        img = Image.open(io.BytesIO(response.content))

        exif_data = img.getexif()

        result = {"original_url": image_url, "has_exif": exif_data is not None}

        if exif_data:
            gps_info = exif_data.get(0x8825)
            if gps_info:
                result["has_gps"] = True

        return result
    except Exception as e:
        return {"original_url": image_url, "error": str(e)}
