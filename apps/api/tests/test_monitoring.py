"""Tests for Sentry event filtering in app.monitoring."""

from app.monitoring import _before_send


def _retry_event(message: str) -> dict:
    return {
        "logger": "celery.worker.consumer.consumer",
        "logentry": {"message": message, "formatted": message},
        "level": "error",
    }


def test_before_send_drops_transient_celery_broker_retry():
    event = _retry_event(
        "consumer: Cannot connect to redis://redis:6379/0: "
        "Error 111 connecting to redis:6379. Connection refused.. "
        "Trying again in 2.00 seconds... (1/100)"
    )

    assert _before_send(event, {}) is None


def test_before_send_keeps_celery_consumer_events_without_retry_text():
    event = {
        "logger": "celery.worker.consumer.consumer",
        "logentry": {"message": "consumer: shutting down"},
        "level": "error",
    }

    assert _before_send(event, {}) is event


def test_before_send_keeps_unrelated_events():
    event = {
        "logger": "app.routers.inspections",
        "logentry": {"message": "Trying again in 2 seconds"},
        "level": "error",
    }

    assert _before_send(event, {}) is event


def test_before_send_strips_cookies_from_request():
    event = {
        "request": {
            "cookies": {"session": "secret"},
            "headers": {"Cookie": "session=secret", "User-Agent": "pytest"},
        },
    }

    result = _before_send(event, {})

    assert result is event
    assert "cookies" not in result["request"]
    assert "Cookie" not in result["request"]["headers"]
    assert result["request"]["headers"]["User-Agent"] == "pytest"


def test_before_send_handles_missing_logentry():
    event = {
        "logger": "celery.worker.consumer.consumer",
        "message": "Trying again in 2.00 seconds... (1/100)",
        "level": "error",
    }

    assert _before_send(event, {}) is None
