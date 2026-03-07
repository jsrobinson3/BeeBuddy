"""Unit tests for app.services.token_usage — AI token usage recording.

Tests mock the database session to verify record_token_usage and
record_chat_usage write the correct data and handle failures gracefully.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.config import LLMProvider
from app.services.token_usage import record_chat_usage, record_token_usage

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db():
    """Return a mock AsyncSession with add, commit, and rollback."""
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


# ---------------------------------------------------------------------------
# record_token_usage
# ---------------------------------------------------------------------------


class TestRecordTokenUsage:
    """Tests for the low-level record_token_usage function."""

    async def test_records_usage_with_all_fields(self):
        """Writes an AITokenUsage row with the supplied values."""
        db = _make_db()
        user_id = uuid.uuid4()
        conv_id = uuid.uuid4()
        usage = {"input_tokens": 100, "output_tokens": 50, "total_tokens": 150}

        with patch("app.services.token_usage.AITokenUsage") as MockModel:
            await record_token_usage(
                db, user_id, conv_id,
                provider="openai", model="gpt-4",
                usage=usage, request_type="stream_chat",
            )

        MockModel.assert_called_once_with(
            user_id=user_id,
            conversation_id=conv_id,
            provider="openai",
            model="gpt-4",
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            request_type="stream_chat",
            estimated=False,
        )
        db.add.assert_called_once()
        db.commit.assert_awaited_once()

    async def test_skips_when_usage_is_empty(self):
        """Does not write when usage dict is empty."""
        db = _make_db()
        await record_token_usage(
            db, uuid.uuid4(), None,
            provider="openai", model="gpt-4",
            usage={}, request_type="stream_chat",
        )
        db.add.assert_not_called()
        db.commit.assert_not_awaited()

    async def test_skips_when_usage_is_none(self):
        """Does not write when usage is None."""
        db = _make_db()
        await record_token_usage(
            db, uuid.uuid4(), None,
            provider="openai", model="gpt-4",
            usage=None, request_type="stream_chat",
        )
        db.add.assert_not_called()

    async def test_skips_when_total_tokens_is_zero(self):
        """Does not write when total_tokens is 0."""
        db = _make_db()
        usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        await record_token_usage(
            db, uuid.uuid4(), None,
            provider="openai", model="gpt-4",
            usage=usage, request_type="stream_chat",
        )
        db.add.assert_not_called()

    async def test_estimated_flag_forwarded(self):
        """The estimated flag is passed through to the model."""
        db = _make_db()
        usage = {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}

        with patch("app.services.token_usage.AITokenUsage") as MockModel:
            await record_token_usage(
                db, uuid.uuid4(), None,
                provider="ollama", model="llama3",
                usage=usage, request_type="stream_chat",
                estimated=True,
            )

        _, kwargs = MockModel.call_args
        assert kwargs["estimated"] is True

    async def test_missing_usage_keys_default_to_zero(self):
        """Missing input/output keys default to 0."""
        db = _make_db()
        usage = {"total_tokens": 100}

        with patch("app.services.token_usage.AITokenUsage") as MockModel:
            await record_token_usage(
                db, uuid.uuid4(), None,
                provider="openai", model="gpt-4",
                usage=usage, request_type="tool_chat",
            )

        _, kwargs = MockModel.call_args
        assert kwargs["input_tokens"] == 0
        assert kwargs["output_tokens"] == 0
        assert kwargs["total_tokens"] == 100

    async def test_conversation_id_can_be_none(self):
        """conversation_id=None is accepted for non-conversation requests."""
        db = _make_db()
        usage = {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}

        with patch("app.services.token_usage.AITokenUsage") as MockModel:
            await record_token_usage(
                db, uuid.uuid4(), None,
                provider="openai", model="gpt-4",
                usage=usage, request_type="summary",
            )

        _, kwargs = MockModel.call_args
        assert kwargs["conversation_id"] is None

    async def test_rollback_on_db_error(self):
        """On database error, rolls back and does not re-raise."""
        db = _make_db()
        db.commit.side_effect = Exception("DB down")
        usage = {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}

        # Should not raise
        await record_token_usage(
            db, uuid.uuid4(), None,
            provider="openai", model="gpt-4",
            usage=usage, request_type="stream_chat",
        )

        db.rollback.assert_awaited_once()


# ---------------------------------------------------------------------------
# record_chat_usage
# ---------------------------------------------------------------------------


class TestRecordChatUsage:
    """Tests for the higher-level record_chat_usage wrapper."""

    @patch("app.services.token_usage.record_token_usage", new_callable=AsyncMock)
    async def test_delegates_to_record_token_usage(self, mock_record):
        """Passes all args through to record_token_usage."""
        db = _make_db()
        user_id = uuid.uuid4()
        conv_id = uuid.uuid4()
        usage = {"input_tokens": 50, "output_tokens": 25, "total_tokens": 75}

        await record_chat_usage(
            db, user_id, conv_id, usage,
            LLMProvider.OPENAI, "gpt-4", "stream_chat",
        )

        mock_record.assert_awaited_once_with(
            db, user_id, conv_id,
            provider="openai",
            model="gpt-4",
            usage=usage,
            request_type="stream_chat",
            estimated=False,
        )

    @patch("app.services.token_usage.record_token_usage", new_callable=AsyncMock)
    async def test_ollama_provider_not_estimated(self, mock_record):
        """Ollama provider usage is not marked as estimated."""
        db = _make_db()
        usage = {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}

        await record_chat_usage(
            db, uuid.uuid4(), None, usage,
            LLMProvider.OLLAMA, "llama3", "stream_chat",
        )

        _, kwargs = mock_record.call_args
        assert kwargs["estimated"] is False

    @patch("app.services.token_usage.record_token_usage", new_callable=AsyncMock)
    async def test_anthropic_provider_not_estimated(self, mock_record):
        """Non-Ollama providers are not marked as estimated."""
        db = _make_db()
        usage = {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}

        await record_chat_usage(
            db, uuid.uuid4(), None, usage,
            LLMProvider.ANTHROPIC, "claude-3", "tool_chat",
        )

        _, kwargs = mock_record.call_args
        assert kwargs["estimated"] is False

    @patch("app.services.token_usage.record_token_usage", new_callable=AsyncMock)
    async def test_provider_converted_to_string(self, mock_record):
        """LLMProvider enum is converted to its string value."""
        db = _make_db()
        usage = {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}

        await record_chat_usage(
            db, uuid.uuid4(), None, usage,
            LLMProvider.HUGGINGFACE, "mistral-7b", "stream_chat",
        )

        _, kwargs = mock_record.call_args
        assert kwargs["provider"] == "huggingface"
