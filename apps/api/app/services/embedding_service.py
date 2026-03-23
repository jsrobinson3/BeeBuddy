"""Embedding service — async wrapper around Ollama /api/embed."""

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_http_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=120)
    return _http_client


async def embed_query(text: str) -> list[float]:
    """Embed a single text string, returning a vector."""
    results = await embed_texts([text])
    return results[0]


async def embed_texts(
    texts: list[str], batch_size: int = 32,
) -> list[list[float]]:
    """Embed a list of texts in batches via Ollama."""
    client = _get_client()
    url = f"{settings.ollama_base_url}/api/embed"
    model = settings.embedding_model
    dim = settings.embedding_dim
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = [_truncate(t) for t in texts[i : i + batch_size]]
        try:
            resp = await client.post(
                url, json={"model": model, "input": batch}, timeout=300,
            )
            resp.raise_for_status()
            all_embeddings.extend(resp.json()["embeddings"])
        except Exception:
            logger.warning("Batch embed failed at offset %d, falling back to individual", i)
            for t in batch:
                all_embeddings.append(await _embed_single(client, url, model, t, dim))

    return all_embeddings


async def _embed_single(
    client: httpx.AsyncClient, url: str, model: str, text: str, dim: int,
) -> list[float]:
    """Embed one text with fallback to zero vector on failure."""
    clean = text[:3000].encode("ascii", errors="ignore").decode()
    if not clean.strip():
        return [0.0] * dim
    try:
        resp = await client.post(
            url, json={"model": model, "input": [clean]}, timeout=120,
        )
        resp.raise_for_status()
        return resp.json()["embeddings"][0]
    except Exception:
        logger.warning("Single embed failed, returning zero vector")
        return [0.0] * dim


def _truncate(text: str, max_words: int = 6000) -> str:
    words = text.split()
    return " ".join(words[:max_words]) if len(words) > max_words else text
