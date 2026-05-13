"""Tests for Sentry event filtering in app.monitoring."""

from app.monitoring import _before_send


def _retry_event() -> dict:
    return {
        "logger": "celery.worker.consumer.consumer",
        "level": "error",
        "logentry": {
            "message": "consumer: Cannot connect to %s: %s.\nTrying again in %s seconds... (%s/%s)",
            "formatted": (
                "consumer: Cannot connect to redis://redis:6379/0: "
                "Error 111 connecting to redis:6379. Connection refused..\n"
                "Trying again in 2.00 seconds... (1/100)"
            ),
        },
    }


def test_drops_celery_transient_connection_retry():
    assert _before_send(_retry_event(), {}) is None


def test_keeps_other_celery_errors():
    event = {
        "logger": "celery.worker.consumer.consumer",
        "level": "error",
        "logentry": {"formatted": "Unrecoverable error: bad task payload"},
    }
    assert _before_send(event, {}) is event


def test_keeps_non_celery_events():
    event = {
        "logger": "app.routers.shares",
        "level": "error",
        "logentry": {"formatted": "Trying again in something — unrelated"},
    }
    assert _before_send(event, {}) is event


def test_strips_cookies_from_request_payload():
    event = {
        "request": {
            "cookies": {"session": "secret"},
            "headers": {"Cookie": "session=secret", "X-Trace": "abc"},
        }
    }
    result = _before_send(event, {})
    assert "cookies" not in result["request"]
    assert "Cookie" not in result["request"]["headers"]
    assert result["request"]["headers"]["X-Trace"] == "abc"
