"""Unit tests for email_service error classification.

Covers the SendGrid response handling that addresses Sentry
BEEBUDDY-BACKEND-1: a misconfigured API key produced 600+ duplicate
``logger.exception`` events because every send hit the same permanent
401 and was logged with full stack trace + email body.
"""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services.email_service import _handle_sendgrid_response, send_email_sync


def _mock_settings(**overrides):
    defaults = {
        "email_suppress": False,
        "sendgrid_api_key": "SG.test",
        "email_from_address": "noreply@example.com",
        "email_from_name": "BeeBuddy",
    }
    defaults.update(overrides)
    s = MagicMock()
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


def _resp(status: int, body: str = "") -> httpx.Response:
    request = httpx.Request("POST", "https://api.sendgrid.com/v3/mail/send")
    return httpx.Response(status_code=status, text=body, request=request)


class TestHandleSendgridResponse:
    def test_success_returns_none(self):
        assert _handle_sendgrid_response(_resp(202), "to@x", "subj") is None

    @pytest.mark.parametrize("status", [400, 401, 403, 404, 413])
    def test_permanent_4xx_is_swallowed(self, status, caplog):
        # Should not raise, should log a warning (not an exception).
        with caplog.at_level("WARNING"):
            _handle_sendgrid_response(_resp(status, "nope"), "to@x", "subj")
        assert any("SendGrid rejected" in r.message for r in caplog.records)
        assert all(r.exc_info is None for r in caplog.records)

    @pytest.mark.parametrize("status", [429, 500, 502, 503])
    def test_transient_errors_raise(self, status):
        with pytest.raises(httpx.HTTPStatusError):
            _handle_sendgrid_response(_resp(status), "to@x", "subj")


class TestSendEmailSync:
    def test_permanent_401_does_not_raise(self):
        with (
            patch(
                "app.services.email_service.get_settings",
                return_value=_mock_settings(),
            ),
            patch(
                "app.services.email_service.httpx.post",
                return_value=_resp(401, "Unauthorized"),
            ),
        ):
            # Must not raise — Celery would otherwise retry a doomed call.
            send_email_sync("to@example.com", "Verify", "<html/>")

    def test_transient_500_raises_for_celery_retry(self):
        with (
            patch(
                "app.services.email_service.get_settings",
                return_value=_mock_settings(),
            ),
            patch(
                "app.services.email_service.httpx.post",
                return_value=_resp(503, "unavailable"),
            ),
            pytest.raises(httpx.HTTPStatusError),
        ):
            send_email_sync("to@example.com", "Verify", "<html/>")

    def test_suppressed_short_circuits(self):
        with (
            patch(
                "app.services.email_service.get_settings",
                return_value=_mock_settings(email_suppress=True),
            ),
            patch("app.services.email_service.httpx.post") as mock_post,
        ):
            send_email_sync("to@example.com", "Verify", "<html/>")
            mock_post.assert_not_called()

    def test_missing_api_key_short_circuits(self):
        with (
            patch(
                "app.services.email_service.get_settings",
                return_value=_mock_settings(sendgrid_api_key=""),
            ),
            patch("app.services.email_service.httpx.post") as mock_post,
        ):
            send_email_sync("to@example.com", "Verify", "<html/>")
            mock_post.assert_not_called()
