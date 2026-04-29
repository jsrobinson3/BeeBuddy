"""Unit tests for email_service error handling.

Verifies that SendGrid 401/403 responses are downgraded to warning logs so they
don't flood Sentry (see BEEBUDDY-BACKEND-1), while other failures still log at
exception level.
"""

import logging
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use")

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.services import email_service  # noqa: E402


@pytest.fixture
def configured_settings(monkeypatch):
    """Override settings so the service actually attempts a send."""
    settings = email_service.get_settings()
    monkeypatch.setattr(settings, "email_suppress", False, raising=False)
    monkeypatch.setattr(settings, "sendgrid_api_key", "fake-key", raising=False)
    return settings


def _build_status_error(status_code: int) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", email_service.SENDGRID_API_URL)
    response = httpx.Response(status_code, request=request)
    return httpx.HTTPStatusError("auth failed", request=request, response=response)


@pytest.mark.parametrize("status_code", [401, 403])
def test_sync_auth_error_logs_warning_not_exception(
    monkeypatch, caplog, configured_settings, status_code,
):
    def fake_post(*_args, **_kwargs):
        raise _build_status_error(status_code)

    monkeypatch.setattr(email_service.httpx, "post", fake_post)

    with caplog.at_level(logging.WARNING, logger=email_service.logger.name):
        email_service.send_email_sync("user@example.com", "Subj", "<p>Hi</p>")

    records = [r for r in caplog.records if r.name == email_service.logger.name]
    assert records, "expected at least one log record"
    assert all(r.levelno == logging.WARNING for r in records), (
        f"auth error should log at WARNING, got: {[(r.levelname, r.message) for r in records]}"
    )
    assert all(r.exc_info is None for r in records), (
        "auth error should not attach exception info (would trigger Sentry)"
    )


def test_sync_server_error_still_logs_exception(monkeypatch, caplog, configured_settings):
    def fake_post(*_args, **_kwargs):
        raise _build_status_error(503)

    monkeypatch.setattr(email_service.httpx, "post", fake_post)

    with caplog.at_level(logging.WARNING, logger=email_service.logger.name):
        email_service.send_email_sync("user@example.com", "Subj", "<p>Hi</p>")

    error_records = [
        r for r in caplog.records
        if r.name == email_service.logger.name and r.levelno == logging.ERROR
    ]
    assert error_records, "5xx errors should still log at ERROR with exc_info"
    assert error_records[0].exc_info is not None


@pytest.mark.parametrize("status_code", [401, 403])
async def test_async_auth_error_logs_warning_not_exception(
    monkeypatch, caplog, configured_settings, status_code,
):
    class FakeResponse:
        def raise_for_status(self):
            raise _build_status_error(status_code)

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

        async def post(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr(email_service.httpx, "AsyncClient", FakeAsyncClient)

    with caplog.at_level(logging.WARNING, logger=email_service.logger.name):
        await email_service._send_email("user@example.com", "Subj", "<p>Hi</p>")

    records = [r for r in caplog.records if r.name == email_service.logger.name]
    assert records, "expected at least one log record"
    assert all(r.levelno == logging.WARNING for r in records)
    assert all(r.exc_info is None for r in records)
