"""Log-level guards for ``send_email_sync``.

Non-retryable SendGrid responses (bad API key, quota exhausted, malformed
payload) are swallowed on purpose — the caller has already decided a retry
will never succeed. Logging them at ERROR would send them to Sentry and page
on-call for an operator config problem, so the module logs at WARNING
instead. Retryable failures still bubble up so Celery's retry handler can
fire.
"""

import os

# Ensure Settings can construct at import time — the api package's
# ``services/__init__`` transitively resolves ``get_settings``.
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-real")

import logging  # noqa: E402
from unittest.mock import patch  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402


def _resp(status: int) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        text="err",
        request=httpx.Request("POST", "https://api.sendgrid.com/v3/mail/send"),
    )


@pytest.fixture
def send_sync():
    from app.services.email_service import send_email_sync

    return send_email_sync


def _settings():
    from types import SimpleNamespace

    return SimpleNamespace(
        email_suppress=False,
        sendgrid_api_key="sg-test",
        email_from_address="from@x",
        email_from_name="X",
    )


def _raise_http_error(resp: httpx.Response):
    def _r():
        raise httpx.HTTPStatusError("err", request=resp.request, response=resp)

    resp.raise_for_status = _r
    return resp


def test_non_retryable_401_logs_at_warning_not_error(send_sync, caplog):
    with patch("app.services.email_service.get_settings", return_value=_settings()), \
         patch("app.services.email_service.httpx.post") as post:
        post.return_value = _raise_http_error(_resp(401))
        with caplog.at_level(logging.DEBUG, logger="app.services.email_service"):
            send_sync("to@x", "s", "<p/>")

    records = [r for r in caplog.records if "Non-retryable SendGrid" in r.getMessage()]
    assert len(records) == 1
    assert records[0].levelno == logging.WARNING


@pytest.mark.parametrize("status", [500, 502, 408, 425, 429])
def test_retryable_still_raises(send_sync, status):
    with patch("app.services.email_service.get_settings", return_value=_settings()), \
         patch("app.services.email_service.httpx.post") as post:
        post.return_value = _raise_http_error(_resp(status))
        with pytest.raises(httpx.HTTPStatusError):
            send_sync("to@x", "s", "<p/>")
