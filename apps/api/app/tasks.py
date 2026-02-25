"""Celery task definitions."""

import logging
import socket
import ssl

import sentry_sdk
from celery import Celery

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.sentry_environment,
        send_default_pii=True,
        enable_tracing=True,
    )

celery_app = Celery("beebuddy", broker=settings.redis_url)
celery_app.conf.broker_connection_retry_on_startup = True

if settings.redis_url.startswith("rediss://"):
    celery_app.conf.broker_use_ssl = {
        "ssl_cert_reqs": ssl.CERT_NONE,
    }

# Keep connections alive to prevent managed Valkey/Redis services (e.g.
# DigitalOcean) from closing idle connections.  TCP keepalive probes start
# after 30 s of idle time, well within the typical 5-minute server timeout.
celery_app.conf.broker_transport_options = {
    "socket_keepalive": True,
    "socket_keepalive_options": {
        socket.TCP_KEEPIDLE: 30,
        socket.TCP_KEEPINTVL: 10,
        socket.TCP_KEEPCNT: 6,
    },
    "socket_connect_timeout": 30,
    "retry_on_timeout": True,
}


@celery_app.task
def generate_inspection_summary(inspection_id: str):
    """Generate AI summary for an inspection. Placeholder for Phase 2."""
    pass


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(self, to: str, subject: str, template_name: str, context: dict):
    """Render an email template and send it via SMTP.

    Runs synchronously inside a Celery worker.
    """
    try:
        from app.services.email_service import render_and_build_html, send_email_sync

        html_body = render_and_build_html(template_name, context)
        send_email_sync(to, subject, html_body)
    except Exception as exc:
        logger.exception("send_email_task failed for %s", to)
        raise self.retry(exc=exc)


async def _hard_delete_user_async(user_id_str: str) -> None:
    """Async implementation of hard_delete_user."""
    from uuid import UUID

    from app.db.session import AsyncSessionLocal
    from app.models.user import User

    user_id = UUID(user_id_str)

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None:
            logger.warning("hard_delete_user: user %s not found, skipping", user_id_str)
            return
        if user.deleted_at is None:
            logger.info(
                "hard_delete_user: user %s deletion was cancelled, skipping",
                user_id_str,
            )
            return

        delete_data = (user.preferences or {}).get("_delete_data", False)

        if delete_data:
            await _full_delete_user(db, user, user_id, user_id_str)
        else:
            await _anonymize_user(db, user, user_id_str)


async def _full_delete_user(db, user, user_id, user_id_str: str) -> None:
    """Delete a user and all their data, including S3 objects."""
    s3_keys = await _collect_s3_keys(db, user_id)
    await db.delete(user)
    await db.commit()
    logger.info("hard_delete_user: fully deleted user %s", user_id_str)
    _delete_s3_objects(s3_keys)


async def _anonymize_user(db, user, user_id_str: str) -> None:
    """Scrub PII from a user record but keep the row."""
    from uuid import uuid4

    user.name = None
    user.email = f"deleted_{uuid4().hex}@anon.beebuddy.app"
    user.password_hash = None
    user.oauth_provider = None
    user.oauth_sub = None
    user.preferences = None
    user.locale = None
    await db.commit()
    logger.info("hard_delete_user: anonymised user %s", user_id_str)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
def hard_delete_user(self, user_id_str: str):
    """Permanently delete a user and all their data after the grace period.

    Only proceeds if the user's deleted_at is still set (i.e. deletion was not
    cancelled during the grace period).

    Reads ``_delete_data`` from the user's preferences to decide between
    anonymisation (default) and full deletion with S3 cleanup.
    """
    import asyncio

    try:
        asyncio.run(_hard_delete_user_async(user_id_str))
    except Exception as exc:
        logger.exception("hard_delete_user failed for user %s", user_id_str)
        raise self.retry(exc=exc)


async def _collect_s3_keys(db, user_id) -> list[str]:
    """Collect all S3 keys for a user's inspection photos."""
    from sqlalchemy import select

    from app.models.apiary import Apiary
    from app.models.hive import Hive
    from app.models.inspection import Inspection
    from app.models.inspection_photo import InspectionPhoto

    stmt = (
        select(InspectionPhoto.s3_key)
        .join(Inspection, InspectionPhoto.inspection_id == Inspection.id)
        .join(Hive, Inspection.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Apiary.user_id == user_id)
    )
    result = await db.execute(stmt)
    return [row[0] for row in result.all()]


def _delete_s3_objects(s3_keys: list[str]) -> None:
    """Delete S3 objects best-effort (synchronous, for Celery context)."""
    if not s3_keys:
        return
    import boto3
    from botocore.config import Config

    settings = get_settings()
    if not settings.aws_access_key_id:
        return
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=Config(signature_version="s3v4"),
    )
    for key in s3_keys:
        try:
            client.delete_object(Bucket=settings.s3_bucket, Key=key)
        except Exception:
            logger.warning("Failed to delete S3 object: %s", key)


async def _generate_cadence_tasks_async() -> None:
    """Async implementation of generate_cadence_tasks_for_all_users."""
    from sqlalchemy import select

    from app.db.session import AsyncSessionLocal
    from app.models.user import User
    from app.services import cadence_service

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User.id).where(User.deleted_at.is_(None))
        )
        user_ids = [row[0] for row in result.all()]

    for uid in user_ids:
        await _generate_cadence_tasks_for_user(uid, cadence_service)


async def _generate_cadence_tasks_for_user(uid, cadence_service) -> None:
    """Generate cadence tasks for a single user."""
    from app.db.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            tasks_created = await cadence_service.generate_due_tasks(db, user_id=uid)
    except Exception:
        logger.exception("Failed to generate cadence tasks for user %s", uid)
        return
    if tasks_created:
        logger.info("Generated %d cadence tasks for user %s", len(tasks_created), uid)


@celery_app.task
def generate_cadence_tasks_for_all_users():
    """Daily Celery beat task: generate due cadence tasks for every active user.

    Intended to be scheduled via Celery Beat (e.g. every day at 06:00 UTC).
    Runs synchronously inside the Celery worker using a one-shot async loop.
    """
    import asyncio

    asyncio.run(_generate_cadence_tasks_async())


@celery_app.task
def celery_worker_heartbeat():
    """Write a heartbeat key to Redis so the API can report worker status."""
    import redis

    settings = get_settings()
    kwargs = {}
    if settings.redis_url.startswith("rediss://"):
        kwargs["ssl_cert_reqs"] = "none"
    r = redis.from_url(settings.redis_url, **kwargs)
    r.set("worker:heartbeat", "1", ex=120)
    r.close()


# Celery Beat schedule
celery_app.conf.beat_schedule = {
    "generate-cadence-tasks-daily": {
        "task": "app.tasks.generate_cadence_tasks_for_all_users",
        "schedule": 60 * 60 * 24,  # every 24 hours
    },
    "celery-worker-heartbeat": {
        "task": "app.tasks.celery_worker_heartbeat",
        "schedule": 60,  # every 60 seconds
    },
}
