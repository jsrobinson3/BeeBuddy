"""Unit tests for the async and sync SendGrid error handling.

Both paths must classify SendGrid responses the same way so a bad API
key or exhausted credits do not flood Sentry with one full-stack event
(carrying the ~5KB HTML body as a local variable) per outbound email.
"""

import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services import email_service


def _fake_settings(**overrides):
    """Minimal settings object accepted by the email service."""
    defaults = {
        "email_suppress": False,
        "sendgrid_api_key": "SG.test",
        "email_from_address": "noreply@beebuddy.dev",
        "email_from_name": "BeeBuddy",
        "app_name": "BeeBuddy",
        "frontend_url": "https://beebuddy.dev",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _http_status_error(status_code: int, body: str = "boom") -> httpx.HTTPStatusError:
    """Build a real HTTPStatusError with a response carrying `status_code`."""
    request = httpx.Request("POST", email_service.SENDGRID_API_URL)
    response = httpx.Response(status_code, text=body, request=request)
    return httpx.HTTPStatusError("error", request=request, response=response)


@pytest.fixture
def settings_patch():
    with patch.object(email_service, "get_settings", return_value=_fake_settings()):
        yield


class TestAsyncSendEmailErrorClassification:
    """`_send_email` must not use `logger.exception` on SendGrid failures.

    `logger.exception` captures a stack trace and every local (including
    the full HTML body) — one Sentry event per email when SendGrid is
    misconfigured. Splitting the httpx exceptions and downgrading the
    log level keeps the alert readable and eliminates the noise.
    """

    async def _run_with_status(self, status: int) -> AsyncMock:
        mock_post = AsyncMock(
            return_value=MagicMock(raise_for_status=MagicMock(
                side_effect=_http_status_error(status),
            )),
        )
        client_ctx = MagicMock()
        client_ctx.__aenter__ = AsyncMock(
            return_value=SimpleNamespace(post=mock_post),
        )
        client_ctx.__aexit__ = AsyncMock(return_value=None)
        with patch.object(httpx, "AsyncClient", return_value=client_ctx):
            await email_service._send_email("to@x", "s", "<html/>")
        return mock_post

    async def test_non_retryable_4xx_logs_error_without_stack_trace(
        self, settings_patch, caplog,
    ):
        with caplog.at_level(logging.DEBUG, logger=email_service.logger.name):
            await self._run_with_status(401)
        [record] = [r for r in caplog.records if r.levelno == logging.ERROR]
        assert "Non-retryable SendGrid error 401" in record.getMessage()
        assert record.exc_info is None

    async def test_retryable_5xx_logs_warning_and_swallows(
        self, settings_patch, caplog,
    ):
        with caplog.at_level(logging.DEBUG, logger=email_service.logger.name):
            await self._run_with_status(503)
        assert not [r for r in caplog.records if r.levelno >= logging.ERROR]
        assert [r for r in caplog.records if r.levelno == logging.WARNING]

    async def test_retryable_429_logs_warning(self, settings_patch, caplog):
        with caplog.at_level(logging.DEBUG, logger=email_service.logger.name):
            await self._run_with_status(429)
        assert not [r for r in caplog.records if r.levelno >= logging.ERROR]

    async def test_transport_error_logs_warning_and_swallows(
        self, settings_patch, caplog,
    ):
        mock_post = AsyncMock(side_effect=httpx.ConnectError("boom"))
        client_ctx = MagicMock()
        client_ctx.__aenter__ = AsyncMock(
            return_value=SimpleNamespace(post=mock_post),
        )
        client_ctx.__aexit__ = AsyncMock(return_value=None)
        with (
            caplog.at_level(logging.DEBUG, logger=email_service.logger.name),
            patch.object(httpx, "AsyncClient", return_value=client_ctx),
        ):
            await email_service._send_email("to@x", "s", "<html/>")
        assert not [r for r in caplog.records if r.levelno >= logging.ERROR]
        assert [r for r in caplog.records if r.levelno == logging.WARNING]

    async def test_success_logs_info(self, settings_patch, caplog):
        mock_post = AsyncMock(
            return_value=MagicMock(raise_for_status=MagicMock(return_value=None)),
        )
        client_ctx = MagicMock()
        client_ctx.__aenter__ = AsyncMock(
            return_value=SimpleNamespace(post=mock_post),
        )
        client_ctx.__aexit__ = AsyncMock(return_value=None)
        with (
            caplog.at_level(logging.DEBUG, logger=email_service.logger.name),
            patch.object(httpx, "AsyncClient", return_value=client_ctx),
        ):
            await email_service._send_email("to@x", "s", "<html/>")
        assert [r for r in caplog.records if r.levelno == logging.INFO]


class TestSyncSendEmailErrorClassification:
    """Guard the sync path so the two implementations stay in lockstep."""

    def test_non_retryable_4xx_logs_error_and_swallows(
        self, settings_patch, caplog,
    ):
        response = MagicMock()
        response.raise_for_status.side_effect = _http_status_error(401)
        with (
            caplog.at_level(logging.DEBUG, logger=email_service.logger.name),
            patch.object(httpx, "post", return_value=response),
        ):
            email_service.send_email_sync("to@x", "s", "<html/>")
        [record] = [r for r in caplog.records if r.levelno == logging.ERROR]
        assert "Non-retryable SendGrid error 401" in record.getMessage()

    def test_retryable_5xx_raises(self, settings_patch, caplog):
        response = MagicMock()
        response.raise_for_status.side_effect = _http_status_error(503)
        with (
            caplog.at_level(logging.DEBUG, logger=email_service.logger.name),
            patch.object(httpx, "post", return_value=response),
            pytest.raises(httpx.HTTPStatusError),
        ):
            email_service.send_email_sync("to@x", "s", "<html/>")
