"""Unit tests for app.services.email_service.

Covers the behaviour that Celery's ``send_email_task`` relies on:
``send_email_sync`` must raise on HTTP error so the task can retry.
"""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import email_service


def _make_response(status_code: int) -> httpx.Response:
    request = httpx.Request("POST", email_service.SENDGRID_API_URL)
    return httpx.Response(status_code=status_code, request=request)


class TestSendEmailSync:
    def test_suppressed_returns_without_calling_http(self, monkeypatch):
        """When email_suppress=True, no HTTP call is made and no error raised."""
        settings = MagicMock(email_suppress=True, sendgrid_api_key="fake")
        monkeypatch.setattr(email_service, "get_settings", lambda: settings)
        with patch.object(email_service.httpx, "post") as post:
            email_service.send_email_sync("a@b.com", "subj", "<p>hi</p>")
            post.assert_not_called()

    def test_missing_api_key_returns_without_calling_http(self, monkeypatch):
        """When SENDGRID_API_KEY is missing, send is skipped (no raise)."""
        settings = MagicMock(email_suppress=False, sendgrid_api_key="")
        monkeypatch.setattr(email_service, "get_settings", lambda: settings)
        with patch.object(email_service.httpx, "post") as post:
            email_service.send_email_sync("a@b.com", "subj", "<p>hi</p>")
            post.assert_not_called()

    def test_success_does_not_raise(self, monkeypatch):
        settings = MagicMock(
            email_suppress=False,
            sendgrid_api_key="fake-key",
            email_from_address="noreply@beebuddy.dev",
            email_from_name="BeeBuddy",
        )
        monkeypatch.setattr(email_service, "get_settings", lambda: settings)
        with patch.object(
            email_service.httpx, "post", return_value=_make_response(202),
        ) as post:
            email_service.send_email_sync("a@b.com", "subj", "<p>hi</p>")
            post.assert_called_once()

    def test_propagates_http_status_error(self, monkeypatch):
        """A 401 from SendGrid must propagate so the Celery task can retry."""
        settings = MagicMock(
            email_suppress=False,
            sendgrid_api_key="bad-key",
            email_from_address="noreply@beebuddy.dev",
            email_from_name="BeeBuddy",
        )
        monkeypatch.setattr(email_service, "get_settings", lambda: settings)
        with patch.object(
            email_service.httpx, "post", return_value=_make_response(401),
        ):
            with pytest.raises(httpx.HTTPStatusError):
                email_service.send_email_sync("a@b.com", "subj", "<p>hi</p>")

    def test_propagates_transport_error(self, monkeypatch):
        """Transport-level failures must propagate so Celery can retry."""
        settings = MagicMock(
            email_suppress=False,
            sendgrid_api_key="fake-key",
            email_from_address="noreply@beebuddy.dev",
            email_from_name="BeeBuddy",
        )
        monkeypatch.setattr(email_service, "get_settings", lambda: settings)
        with patch.object(
            email_service.httpx,
            "post",
            side_effect=httpx.ConnectTimeout("connect timeout"),
        ):
            with pytest.raises(httpx.ConnectTimeout):
                email_service.send_email_sync("a@b.com", "subj", "<p>hi</p>")
