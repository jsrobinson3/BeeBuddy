"""Tests for knowledge_service — HF seed download retry logic."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


def _mock_response(status_code: int = 500) -> httpx.Response:
    """Create a minimal httpx.Response for HfHubHTTPError construction."""
    return httpx.Response(status_code=status_code, request=httpx.Request("GET", "https://hf.co"))


@pytest.fixture
def mock_db():
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = []
    db.execute.return_value = result
    return db


class TestLoadSeedFromHfRetry:
    """Verify load_seed_from_hf retries transient errors."""

    @patch("app.services.knowledge_service.load_seed", new_callable=AsyncMock, return_value=42)
    @patch("app.services.knowledge_service.asyncio.to_thread")
    async def test_succeeds_on_first_try(self, mock_to_thread, mock_load_seed, mock_db):
        mock_to_thread.return_value = "/tmp/seed.jsonl"

        from app.services.knowledge_service import load_seed_from_hf

        result = await load_seed_from_hf(mock_db, repo_id="test/repo")
        assert result == 42
        assert mock_to_thread.call_count == 1

    @patch("app.services.knowledge_service.load_seed", new_callable=AsyncMock, return_value=10)
    @patch("app.services.knowledge_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.knowledge_service.asyncio.to_thread")
    async def test_retries_on_transient_error(
        self, mock_to_thread, mock_sleep, mock_load_seed, mock_db
    ):
        from huggingface_hub.utils import HfHubHTTPError

        mock_to_thread.side_effect = [
            HfHubHTTPError("503 Service Unavailable", response=_mock_response(503)),
            "/tmp/seed.jsonl",
        ]

        from app.services.knowledge_service import load_seed_from_hf

        result = await load_seed_from_hf(mock_db, repo_id="test/repo", max_retries=2)
        assert result == 10
        assert mock_to_thread.call_count == 2
        mock_sleep.assert_called_once_with(2)  # 2^(0+1)

    @patch("app.services.knowledge_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.knowledge_service.asyncio.to_thread")
    async def test_raises_after_all_retries_exhausted(
        self, mock_to_thread, mock_sleep, mock_db
    ):
        mock_to_thread.side_effect = OSError("Connection reset")

        from app.services.knowledge_service import load_seed_from_hf

        with pytest.raises(OSError, match="Connection reset"):
            await load_seed_from_hf(mock_db, repo_id="test/repo", max_retries=2)

        assert mock_to_thread.call_count == 3  # initial + 2 retries
        assert mock_sleep.call_count == 2

    @patch("app.services.knowledge_service.asyncio.to_thread")
    async def test_no_retry_on_repo_not_found(self, mock_to_thread, mock_db):
        from huggingface_hub.utils import RepositoryNotFoundError

        mock_to_thread.side_effect = RepositoryNotFoundError(
            "not found", response=_mock_response(404)
        )

        from app.services.knowledge_service import load_seed_from_hf

        with pytest.raises(RepositoryNotFoundError):
            await load_seed_from_hf(mock_db, repo_id="bad/repo", max_retries=3)

        assert mock_to_thread.call_count == 1  # no retries

    @patch("app.services.knowledge_service.asyncio.to_thread")
    async def test_no_retry_on_entry_not_found(self, mock_to_thread, mock_db):
        from huggingface_hub.utils import EntryNotFoundError

        mock_to_thread.side_effect = EntryNotFoundError("file missing")

        from app.services.knowledge_service import load_seed_from_hf

        with pytest.raises(EntryNotFoundError):
            await load_seed_from_hf(mock_db, repo_id="test/repo", max_retries=3)

        assert mock_to_thread.call_count == 1
