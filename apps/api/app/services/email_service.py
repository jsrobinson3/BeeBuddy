"""Email sending service using SendGrid API and Jinja2 templates."""

import logging
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader

from app.config import get_settings

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"
SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=True,
)


def _build_payload(to: str, subject: str, html_body: str) -> dict:
    """Build SendGrid v3 Mail Send API payload."""
    settings = get_settings()
    return {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": settings.email_from_address, "name": settings.email_from_name},
        "subject": subject,
        "content": [{"type": "text/html", "value": html_body}],
    }


def _log_permanent_failure(to: str, exc: httpx.HTTPStatusError) -> None:
    """Log a permanent SendGrid failure without a traceback.

    A 4xx from SendGrid (e.g. 401 unauthorised, 403 forbidden) is a
    configuration problem, not a transient error: retrying will not help and
    the stack trace adds no signal. ``logger.error`` without ``exc_info``
    emits a single grouped event in monitoring rather than one traceback per
    attempt.
    """
    logger.error(
        "SendGrid rejected email to %s (status %d): %s",
        to, exc.response.status_code, exc.response.text[:500],
    )


async def _send_email(to: str, subject: str, html_body: str) -> None:
    """Send an email via SendGrid API or log it when suppressed.

    Called from request handlers where we never want a failed email to bubble
    up and abort the request — failures are logged and swallowed.
    """
    settings = get_settings()

    if settings.email_suppress:
        logger.info(
            "Email suppressed (email_suppress=True)\n"
            "  To: %s\n  Subject: %s\n  Body:\n%s",
            to, subject, html_body,
        )
        return

    if not settings.sendgrid_api_key:
        logger.warning("SENDGRID_API_KEY not configured; skipping email to %s", to)
        return

    payload = _build_payload(to, subject, html_body)

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                SENDGRID_API_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
                timeout=10.0,
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if 400 <= exc.response.status_code < 500:
            _log_permanent_failure(to, exc)
            return
        logger.exception("Transient SendGrid error sending email to %s", to)
        return
    except httpx.RequestError as exc:
        logger.error("Network error sending email to %s: %s", to, exc)
        return

    logger.info("Email sent to %s: %s", to, subject)


def send_email_sync(to: str, subject: str, html_body: str) -> None:
    """Synchronous email send for use in Celery workers.

    Permanent failures (4xx) are logged and swallowed — retrying cannot fix a
    bad API key or rejected sender. Transient failures (5xx, network errors)
    propagate so the calling Celery task can retry them.
    """
    settings = get_settings()

    if settings.email_suppress:
        logger.info(
            "Email suppressed (email_suppress=True)\n"
            "  To: %s\n  Subject: %s\n  Body:\n%s",
            to, subject, html_body,
        )
        return

    if not settings.sendgrid_api_key:
        logger.warning("SENDGRID_API_KEY not configured; skipping email to %s", to)
        return

    payload = _build_payload(to, subject, html_body)

    try:
        resp = httpx.post(
            SENDGRID_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
            timeout=10.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if 400 <= exc.response.status_code < 500:
            _log_permanent_failure(to, exc)
            return
        raise
    logger.info("Email sent to %s: %s", to, subject)


def _render_template(template_name: str, context: dict) -> str:
    """Render a Jinja2 email template."""
    template = _jinja_env.get_template(template_name)
    return template.render(**context)


def render_and_build_html(template_name: str, context: dict) -> str:
    """Render a template — public helper used by the Celery task.

    Automatically injects ``frontend_url`` and ``app_name`` into the context
    and builds action URLs from a raw ``token`` when the template-specific URL
    key is missing (e.g. ``verify_url`` for ``verify_email.html``).
    """
    settings = get_settings()
    enriched = {
        "app_name": settings.app_name,
        "frontend_url": settings.frontend_url,
        **context,
    }

    # Build the action URL from token if the template-specific key is absent.
    token = enriched.get("token")
    if token:
        _URL_TEMPLATES: dict[str, tuple[str, str]] = {
            "verify_email.html": ("verify_url", "/verify-email?token="),
            "password_reset.html": ("reset_url", "/reset-password?token="),
            "account_deletion.html": ("cancel_url", "/cancel-deletion?token="),
        }
        mapping = _URL_TEMPLATES.get(template_name)
        if mapping and mapping[0] not in enriched:
            key, path = mapping
            enriched[key] = f"{settings.frontend_url}{path}{token}"

    return _render_template(template_name, enriched)


async def send_verification_email(to: str, token: str) -> None:
    """Send an email-verification link."""
    settings = get_settings()
    verify_url = f"{settings.frontend_url}/verify-email?token={token}"
    html = _render_template(
        "verify_email.html",
        {"verify_url": verify_url, "app_name": settings.app_name},
    )
    await _send_email(to, f"Verify your {settings.app_name} email", html)


async def send_password_reset_email(to: str, token: str) -> None:
    """Send a password-reset link."""
    settings = get_settings()
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    html = _render_template(
        "password_reset.html",
        {"reset_url": reset_url, "app_name": settings.app_name},
    )
    await _send_email(to, f"Reset your {settings.app_name} password", html)


async def send_account_deletion_email(to: str, cancel_token: str) -> None:
    """Send an account-deletion notice with a cancellation link."""
    settings = get_settings()
    cancel_url = f"{settings.frontend_url}/cancel-deletion?token={cancel_token}"
    html = _render_template(
        "account_deletion.html",
        {"cancel_url": cancel_url, "app_name": settings.app_name},
    )
    await _send_email(to, f"Your {settings.app_name} account is scheduled for deletion", html)
