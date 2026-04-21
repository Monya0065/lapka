"""Yandex Vision OCR and image analysis service."""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Any

import httpx

from src.core.config import settings as _settings

logger = logging.getLogger(__name__)


@dataclass
class VisionAnalysisResult:
    """Result from Yandex Vision analysis."""
    text_found: str | None
    labels: list[str]
    objects_detected: list[dict[str, Any]]
    raw_response: dict[str, Any] | None


class YandexVisionService:
    """Yandex Vision API client for OCR and image analysis."""

    def __init__(self):
        self.enabled = _settings.yandex_vision_enabled and _settings.yandex_vision_folder_id
        self.folder_id = _settings.yandex_vision_folder_id
        self._iam_token: str | None = None

    async def _get_iam_token(self) -> str | None:
        """Get IAM token for Yandex Cloud."""
        if not _settings.yandex_cloud_api_key:
            return None
        if self._iam_token:
            return self._iam_token

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://iam.api.cloud.yandex.net/iam/v1/tokens",
                    json={"yandexCloudApiKey": _settings.yandex_cloud_api_key},
                )
                if response.status_code == 200:
                    data = response.json()
                    self._iam_token = data.get("iamToken")
                    return self._iam_token
        except Exception as e:
            logger.warning(f"Failed to get IAM token: {e}")
        return None

    async def analyze_image(self, image_data: bytes | str) -> VisionAnalysisResult:
        """
        Analyze image using Yandex Vision.
        
        Args:
            image_data: Either raw bytes or base64-encoded string, or URL
            
        Returns:
            VisionAnalysisResult with OCR text, labels, and detected objects
        """
        if not self.enabled:
            logger.info("Yandex Vision disabled, returning empty result")
            return VisionAnalysisResult(
                text_found=None,
                labels=[],
                objects_detected=[],
                raw_response=None,
            )

        iam_token = await self._get_iam_token()
        if not iam_token:
            logger.warning("No IAM token available for Yandex Vision")
            return VisionAnalysisResult(
                text_found=None,
                labels=[],
                objects_detected=[],
                raw_response=None,
            )

        headers = {
            "Authorization": f"Bearer {iam_token}",
            "Content-Type": "application/json",
        }

        image_payload: dict[str, Any]
        if isinstance(image_data, str):
            if image_data.startswith("http"):
                image_payload = {"image_url": {"url": image_data}}
            else:
                image_payload = {"image_base64": image_data}
        else:
            image_payload = {"image_base64": base64.b64encode(image_data).decode()}

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.post(
                    f"https://vision.api.cloud.yandex.net/vision/v1/analyze",
                    headers=headers,
                    params={"folderId": self.folder_id},
                    json={
                        "analyze_specs": [
                            {
                                "feature_set": {
                                    "features": [
                                        {"type": "TEXT_DETECTION"},
                                        {"type": "LABEL_DETECTION"},
                                        {"type": "OBJECT_DETECTION"},
                                    ]
                                },
                                **image_payload,
                            }
                        ]
                    },
                )

                if response.status_code != 200:
                    logger.warning(f"Yandex Vision API error: {response.status_code}")
                    return VisionAnalysisResult(
                        text_found=None,
                        labels=[],
                        objects_detected=[],
                        raw_response=None,
                    )

                data = response.json()
                results = data.get("results", [])

                text_found = None
                labels = []
                objects_detected = []

                if results:
                    result = results[0]
                    results_inner = result.get("results", [])

                    for res in results_inner:
                        text_detection = res.get("textDetection", {})
                        if text_detection:
                            text_found = text_detection.get("text", "")

                        label_detection = res.get("labelDetection", {})
                        if label_detection:
                            for label in label_detection.get("labels", []):
                                labels.append(label.get("name", ""))

                        object_detection = res.get("objectDetection", {})
                        if object_detection:
                            for obj in object_detection.get("objects", []):
                                objects_detected.append(
                                    {
                                        "name": obj.get("name", ""),
                                        "confidence": obj.get("confidence", 0),
                                        "bounding_box": obj.get("boundingBox", {}),
                                    }
                                )

                return VisionAnalysisResult(
                    text_found=text_found,
                    labels=labels,
                    objects_detected=objects_detected,
                    raw_response=data,
                )

            except Exception as e:
                logger.error(f"Yandex Vision analysis failed: {e}")
                return VisionAnalysisResult(
                    text_found=None,
                    labels=[],
                    objects_detected=[],
                    raw_response=None,
                )

    async def detect_text(self, image_data: bytes | str) -> str | None:
        """Simple OCR: extract text from image."""
        result = await self.analyze_image(image_data)
        return result.text_found


vision_service = YandexVisionService()

__all__ = ["YandexVisionService", "VisionAnalysisResult", "vision_service"]