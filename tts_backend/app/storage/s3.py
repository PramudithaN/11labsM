import base64
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config
import io
import logging
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

REDIS_AUDIO_PREFIX = "audio_data:"
REDIS_AUDIO_TTL = 86_400  # 24 hours


def _s3_configured() -> bool:
    return bool(settings.s3_access_key and settings.s3_secret_key)


def _get_client():
    kwargs = {
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
        "region_name": settings.s3_region,
        "config": Config(signature_version="s3v4"),
    }
    if settings.s3_endpoint_url:
        # MinIO or custom S3-compatible store
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client("s3", **kwargs)


def upload_audio(job_id: str, language: str, voice_id: str, audio_bytes: bytes, audio_format: str = "mp3_44100_128") -> str:
    """
    Upload audio bytes. Uses S3/MinIO when configured, falls back to Redis otherwise.
    Returns a key string used to retrieve the audio later.
    """
    ext = "mp3" if "mp3" in audio_format else "wav"
    key = f"{job_id}/{language}_{voice_id}.{ext}"

    if not _s3_configured():
        # Redis fallback — store base64-encoded audio directly in Redis
        import redis as _redis
        r = _redis.from_url(settings.redis_url, decode_responses=False)
        r.set(f"{REDIS_AUDIO_PREFIX}{key}", base64.b64encode(audio_bytes), ex=REDIS_AUDIO_TTL)
        r.close()
        logger.info("Stored audio in Redis: %s", key)
        return f"redis:{key}"

    content_type = "audio/mpeg" if ext == "mp3" else "audio/wav"
    client = _get_client()
    try:
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=audio_bytes,
            ContentType=content_type,
        )
        logger.info("Uploaded %s to s3://%s/%s", key, settings.s3_bucket, key)
        return key
    except ClientError as exc:
        logger.error("S3 upload failed for key %s: %s", key, exc)
        raise


def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a pre-signed download URL (default 1 hour).
    If S3_PUBLIC_ENDPOINT_URL is set, the internal Docker hostname in the URL
    is replaced with the public hostname so browsers can reach it.
    """
    client = _get_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=expires_in,
    )
    if settings.s3_public_endpoint_url and settings.s3_endpoint_url:
        url = url.replace(settings.s3_endpoint_url, settings.s3_public_endpoint_url, 1)
    return url


def download_audio(key: str) -> bytes:
    """Download raw bytes for a stored audio file."""
    if key.startswith("redis:"):
        import redis as _redis
        r = _redis.from_url(settings.redis_url, decode_responses=False)
        data = r.get(f"{REDIS_AUDIO_PREFIX}{key[6:]}")
        r.close()
        if not data:
            raise FileNotFoundError(f"Audio not found in Redis: {key}")
        return base64.b64decode(data)

    client = _get_client()
    response = client.get_object(Bucket=settings.s3_bucket, Key=key)
    return response["Body"].read()


def ensure_bucket_exists():
    """Create the S3 bucket if it doesn't exist (useful for local MinIO dev)."""
    client = _get_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_bucket)
        logger.info("Created bucket: %s", settings.s3_bucket)
