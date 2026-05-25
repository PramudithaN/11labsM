import hashlib
import redis as redis_client
from app.config import get_settings

settings = get_settings()

_redis = redis_client.from_url(settings.redis_url, decode_responses=True)

CACHE_TTL = 60 * 60 * 24 * 7  # 7 days


def _cache_key(text: str, language: str, voice_id: str, audio_format: str) -> str:
    payload = f"{text}|{language}|{voice_id}|{audio_format}"
    digest = hashlib.sha256(payload.encode()).hexdigest()
    return f"tts_cache:{digest}"


def get_cached_key(text: str, language: str, voice_id: str, audio_format: str) -> str | None:
    """Return the S3 key if this exact (text, language, voice, format) was already generated."""
    return _redis.get(_cache_key(text, language, voice_id, audio_format))


def set_cached_key(text: str, language: str, voice_id: str, audio_format: str, s3_key: str):
    """Store the S3 key for a generated audio piece."""
    _redis.setex(_cache_key(text, language, voice_id, audio_format), CACHE_TTL, s3_key)
