"""S3-compatible storage service (MinIO in dev, S3/Spaces/B2 in prod)."""

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator

import boto3
from botocore.config import Config

from app.config import get_settings

logger = logging.getLogger(__name__)

_client = None
_public_client = None


def _get_client():
    """Get the boto3 S3 client for internal operations."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            config=Config(signature_version="s3v4"),
        )
    return _client


def _get_public_client():
    """Get a boto3 S3 client using the public URL for presigned URLs.

    Falls back to the internal client if s3_public_url is not configured.
    """
    global _public_client
    if _public_client is None:
        settings = get_settings()
        if not settings.s3_public_url:
            return _get_client()
        _public_client = boto3.client(
            "s3",
            endpoint_url=settings.s3_public_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            config=Config(signature_version="s3v4"),
        )
    return _public_client


def generate_presigned_url(s3_key: str) -> str | None:
    """Generate a short-lived presigned GET URL for an S3 object.

    Returns None if S3 credentials are not configured.
    Synchronous — boto3 presigning is local computation, no network call.
    """
    settings = get_settings()
    if not settings.aws_access_key_id:
        return None
    client = _get_public_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": s3_key},
        ExpiresIn=settings.presigned_url_ttl_seconds,
    )


async def ensure_bucket_exists() -> None:
    """Check the photos bucket exists. Logs a warning on failure instead of crashing."""
    settings = get_settings()
    if not settings.aws_access_key_id:
        logger.warning("S3 credentials not configured; skipping bucket check")
        return
    try:
        client = _get_client()
        await asyncio.to_thread(client.head_bucket, Bucket=settings.s3_bucket)
        logger.info("S3 bucket '%s' verified", settings.s3_bucket)
    except Exception:
        logger.warning(
            "S3 bucket '%s' not accessible — photo uploads will fail until resolved",
            settings.s3_bucket,
        )


def generate_key(user_id: str, inspection_id: str, file_ext: str) -> str:
    """Generate a unique S3 key for a photo."""
    return f"users/{user_id}/inspections/{inspection_id}/{uuid.uuid4()}.{file_ext}"


async def upload_fileobj(s3_key: str, fileobj, content_type: str) -> None:
    """Upload a file-like object to S3."""
    settings = get_settings()
    await asyncio.to_thread(
        _get_client().upload_fileobj,
        fileobj,
        settings.s3_bucket,
        s3_key,
        ExtraArgs={"ContentType": content_type},
    )


async def get_object_content_type(s3_key: str) -> str:
    """Get the content type of an S3 object."""
    settings = get_settings()
    resp = await asyncio.to_thread(
        _get_client().head_object,
        Bucket=settings.s3_bucket,
        Key=s3_key,
    )
    return resp.get("ContentType", "application/octet-stream")


async def stream_object(s3_key: str, chunk_size: int = 64 * 1024) -> AsyncIterator[bytes]:
    """Stream an S3 object in chunks as an async iterator."""
    settings = get_settings()
    response = await asyncio.to_thread(
        _get_client().get_object,
        Bucket=settings.s3_bucket,
        Key=s3_key,
    )
    body = response["Body"]
    try:
        while True:
            chunk = await asyncio.to_thread(body.read, chunk_size)
            if not chunk:
                break
            yield chunk
    finally:
        await asyncio.to_thread(body.close)


async def delete_object(s3_key: str) -> None:
    """Delete an object from S3."""
    settings = get_settings()
    await asyncio.to_thread(
        _get_client().delete_object,
        Bucket=settings.s3_bucket,
        Key=s3_key,
    )
