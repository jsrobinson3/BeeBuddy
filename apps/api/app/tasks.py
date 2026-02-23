"""Celery task definitions."""

import logging
import socket
import ssl

from celery import Celery

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

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


@celery_app.task
def hard_delete_user(user_id_str: str):
    """Permanently delete a user and all their data after the grace period.

    Only proceeds if the user's deleted_at is still set (i.e. deletion was not
    cancelled during the grace period). Filled in during Phase 4.
    """
    logger.info("hard_delete_user called for user %s (skeleton — not yet implemented)", user_id_str)
