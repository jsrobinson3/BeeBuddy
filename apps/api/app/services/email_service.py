"""Email sending service using aiosmtplib and Jinja2 templates."""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader

from app.config import get_settings

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=True,
)


async def _send_email(to: str, subject: str, html_body: str) -> None:
    """Send an email via SMTP or log it when suppressed."""
    settings = get_settings()

    if settings.smtp_suppress:
        logger.info(
            "Email suppressed (smtp_suppress=True)\n"
            "  To: %s\n  Subject: %s\n  Body:\n%s",
            to,
            subject,
            html_body,
        )
        return

    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP credentials not configured; skipping email to %s", to)
        return

    message = MIMEMultipart("alternative")
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to
    message["Subject"] = subject
    message.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=settings.smtp_starttls,
        )
        logger.info("Email sent to %s: %s", to, subject)
    except Exception:
        logger.exception("Failed to send email to %s: %s", to, subject)


def _render_template(template_name: str, context: dict) -> str:
    """Render a Jinja2 email template."""
    template = _jinja_env.get_template(template_name)
    return template.render(**context)


def render_and_build_html(template_name: str, context: dict) -> str:
    """Render a template — public helper used by the Celery task."""
    return _render_template(template_name, context)


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


def send_email_sync(to: str, subject: str, html_body: str) -> None:
    """Synchronous email send for use in Celery workers."""
    import smtplib

    settings = get_settings()

    if settings.smtp_suppress:
        logger.info(
            "Email suppressed (smtp_suppress=True)\n"
            "  To: %s\n  Subject: %s\n  Body:\n%s",
            to,
            subject,
            html_body,
        )
        return

    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP credentials not configured; skipping email to %s", to)
        return

    message = MIMEMultipart("alternative")
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to
    message["Subject"] = subject
    message.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_starttls:
                server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(message)
        logger.info("Email sent to %s: %s", to, subject)
    except Exception:
        logger.exception("Failed to send email to %s: %s", to, subject)
