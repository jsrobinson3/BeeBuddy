"""S3-compatible storage service (MinIO in dev, S3/Spaces/B2 in prod)."""

import asyncio
import uuid
from collections.abc import AsyncIterator

import boto3
from botocore.config import Config

from app.config import get_settings

_client = None


def _get_client():
    """Get the boto3 S3 client for all operations."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            config=Config(signature_version="s3v4"),
        )
    return _client


async def ensure_bucket_exists() -> None:
    """Create the photos bucket if it does not already exist."""
    client = _get_client()
    settings = get_settings()
    await asyncio.to_thread(_ensure_bucket_sync, client, settings.s3_bucket)


def _ensure_bucket_sync(client, bucket: str) -> None:
    """Synchronous helper for ensure_bucket_exists."""
    try:
        client.head_bucket(Bucket=bucket)
    except client.exceptions.ClientError:
        client.create_bucket(Bucket=bucket)


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
