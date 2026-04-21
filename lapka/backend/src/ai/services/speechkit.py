"""Yandex SpeechKit STT/TTS service."""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Any

import httpx

from src.core.config import settings as _settings

logger = logging.getLogger(__name__)


@dataclass
class TranscriptionResult:
    """Result from speech-to-text."""
    text: str
    confidence: float


@dataclass
class SynthesisResult:
    """Result from text-to-speech."""
    audio_base64: str
    format: str = "oggopus"


class YandexSpeechKitService:
    """Yandex SpeechKit API client for STT and TTS."""

    def __init__(self):
        self.enabled_stt = _settings.yandex_speechkit_enabled and _settings.yandex_speechkit_folder_id
        self.enabled_tts = _settings.yandex_speechkit_enabled and _settings.yandex_speechkit_folder_id
        self.folder_id = _settings.yandex_speechkit_folder_id
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

    async def transcribe_audio(
        self,
        audio_data: bytes,
        format: str = "oggopus",
        sample_rate: int = 48000,
        language: str = "ru-RU",
    ) -> TranscriptionResult | None:
        """
        Convert speech to text using Yandex SpeechKit.
        
        Args:
            audio_data: Raw audio bytes
            format: Audio format (oggopus, lpcm, wav)
            sample_rate: Sample rate (48000, 16000, 8000)
            language: Language code
            
        Returns:
            TranscriptionResult with text and confidence
        """
        if not self.enabled_stt:
            logger.info("Yandex SpeechKit STT disabled, returning demo result")
            return TranscriptionResult(
                text="Демо-расшифровка голосового сообщения. Здесь будет текст из аудиозаписи приёма.",
                confidence=0.9,
            )

        iam_token = await self._get_iam_token()
        if not iam_token:
            logger.warning("No IAM token available for SpeechKit STT")
            return None

        audio_base64 = base64.b64encode(audio_data).decode()

        async with httpx.AsyncClient(timeout=60) as client:
            try:
                response = await client.post(
                    "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize",
                    headers={
                        "Authorization": f"Bearer {iam_token}",
                        "Content-Type": "application/json",
                    },
                    params={"folderId": self.folder_id},
                    json={
                        "audioSpec": {
                            "format": format,
                            "sampleRate": sample_rate,
                            "languageCode": language,
                        },
                        "audio": audio_base64,
                    },
                )

                if response.status_code != 200:
                    logger.warning(f"SpeechKit STT API error: {response.status_code}")
                    return None

                data = response.json()
                text = data.get("result", "")
                confidence = data.get("confidence", 0.9)

                if text:
                    return TranscriptionResult(text=text, confidence=confidence)

                return None

            except Exception as e:
                logger.error(f"SpeechKit transcription failed: {e}")
                return None

    async def synthesize_speech(
        self,
        text: str,
        voice: str = "alena",
        format: str = "oggopus",
        sample_rate: int = 48000,
        language: str = "ru-RU",
    ) -> SynthesisResult | None:
        """
        Convert text to speech using Yandex SpeechKit.
        
        Args:
            text: Text to synthesize
            voice: Voice name (alena, ermil, jane, oxana, yandex)
            format: Output format (oggopus, lpcm, wav, mp3)
            sample_rate: Sample rate
            language: Language code
            
        Returns:
            SynthesisResult with base64-encoded audio
        """
        if not self.enabled_tts:
            logger.info("Yandex SpeechKit TTS disabled")
            return None

        iam_token = await self._get_iam_token()
        if not iam_token:
            logger.warning("No IAM token available for SpeechKit TTS")
            return None

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.post(
                    "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize",
                    headers={
                        "Authorization": f"Bearer {iam_token}",
                        "Content-Type": "application/json",
                    },
                    params={"folderId": self.folder_id},
                    json={
                        "text": text,
                        "voice": voice,
                        "format": format,
                        "sampleRate": sample_rate,
                        "languageCode": language,
                    },
                )

                if response.status_code != 200:
                    logger.warning(f"SpeechKit TTS API error: {response.status_code}")
                    return None

                audio_base64 = base64.b64encode(response.content).decode()
                return SynthesisResult(audio_base64=audio_base64, format=format)

            except Exception as e:
                logger.error(f"SpeechKit synthesis failed: {e}")
                return None

    async def transcribe_file(
        self,
        filename: str,
        audio_data: bytes,
    ) -> TranscriptionResult | None:
        """Transcribe audio file with automatic format detection."""
        format_map = {
            ".ogg": "oggopus",
            ".mp3": "mp3",
            ".wav": "wav",
            ".m4a": "oggopus",
        }
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "ogg"
        format = format_map.get(f".{ext}", "oggopus")

        sample_rate = 48000 if format == "oggopus" else 16000

        return await self.transcribe_audio(audio_data, format=format, sample_rate=sample_rate)


speechkit_service = YandexSpeechKitService()

__all__ = ["YandexSpeechKitService", "TranscriptionResult", "SynthesisResult", "speechkit_service"]