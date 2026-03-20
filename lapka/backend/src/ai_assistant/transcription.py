from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile, status

SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a"}
SUPPORTED_AUDIO_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
}


@dataclass
class TranscriptionResult:
    transcript: str
    duration_sec: float


def _estimate_duration_seconds(audio_bytes_count: int, ext: str) -> float:
    if ext == ".wav":
        approx_bps = 16000 * 2
    elif ext == ".mp3":
        approx_bps = 16000
    else:
        approx_bps = 12000
    duration = audio_bytes_count / max(1, approx_bps)
    return round(max(1.0, duration), 2)


async def transcribe_audio_file(audio_file: UploadFile) -> TranscriptionResult:
    filename = audio_file.filename or "audio"
    ext = os.path.splitext(filename.lower())[1]
    content_type = (audio_file.content_type or "").lower()

    if ext not in SUPPORTED_AUDIO_EXTENSIONS and content_type not in SUPPORTED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "code": "UNSUPPORTED_AUDIO_FORMAT",
                "message": "Supported formats: wav, mp3, m4a",
            },
        )

    payload = await audio_file.read()
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_AUDIO", "message": "Audio file is empty"},
        )

    duration_sec = _estimate_duration_seconds(len(payload), ext or ".wav")
    transcript = (
        f"Демо-расшифровка приёма ({filename}). "
        "Ключевые жалобы и наблюдения извлечены для структурирования визита."
    )
    return TranscriptionResult(transcript=transcript, duration_sec=duration_sec)
