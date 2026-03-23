"""Embedding service — supports Ollama (local) and HuggingFace Inference API."""

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_http_client: httpx.AsyncClient | None = None

HF_EMBED_URL = "https://router.huggingface.co/hf-inference/pipeline/feature-extraction"


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
    """Embed a list of texts via the configured provider."""
    if settings.embedding_provider == "huggingface":
        return await _embed_texts_hf(texts, batch_size)
    return await _embed_texts_ollama(texts, batch_size)


# ---------------------------------------------------------------------------
# Ollama backend
# ---------------------------------------------------------------------------
async def _embed_texts_ollama(texts: list[str], batch_size: int) -> list[list[float]]:
    client = _get_client()
    url = f"{settings.ollama_base_url}/api/embed"
    model = settings.embedding_model
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = [_truncate(t) for t in texts[i : i + batch_size]]
        try:
            resp = await client.post(url, json={"model": model, "input": batch}, timeout=300)
            resp.raise_for_status()
            all_embeddings.extend(resp.json()["embeddings"])
        except Exception:
            logger.warning("Ollama batch failed at offset %d, falling back", i)
            for t in batch:
                all_embeddings.append(await _embed_single_ollama(client, url, model, t))

    return all_embeddings


async def _embed_single_ollama(
    client: httpx.AsyncClient, url: str, model: str, text: str,
) -> list[float]:
    clean = _truncate(text)[:3000]
    if not clean.strip():
        return [0.0] * settings.embedding_dim
    try:
        resp = await client.post(url, json={"model": model, "input": [clean]}, timeout=120)
        resp.raise_for_status()
        return resp.json()["embeddings"][0]
    except Exception:
        logger.warning("Ollama single embed failed, returning zero vector")
        return [0.0] * settings.embedding_dim


# ---------------------------------------------------------------------------
# HuggingFace Inference API backend
# ---------------------------------------------------------------------------
async def _embed_texts_hf(texts: list[str], batch_size: int) -> list[list[float]]:
    client = _get_client()
    url = f"{HF_EMBED_URL}/{settings.embedding_model}"
    headers = {"Authorization": f"Bearer {settings.hf_token}"}
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = [_truncate(t) for t in texts[i : i + batch_size]]
        try:
            resp = await client.post(
                url, json={"inputs": batch}, headers=headers, timeout=300,
            )
            resp.raise_for_status()
            all_embeddings.extend(resp.json())
        except Exception:
            logger.warning("HF batch failed at offset %d, falling back", i)
            for t in batch:
                all_embeddings.append(await _embed_single_hf(client, url, headers, t))

    return all_embeddings


async def _embed_single_hf(
    client: httpx.AsyncClient, url: str, headers: dict, text: str,
) -> list[float]:
    clean = _truncate(text)[:3000]
    if not clean.strip():
        return [0.0] * settings.embedding_dim
    try:
        resp = await client.post(
            url, json={"inputs": [clean]}, headers=headers, timeout=120,
        )
        resp.raise_for_status()
        return resp.json()[0]
    except Exception:
        logger.warning("HF single embed failed, returning zero vector")
        return [0.0] * settings.embedding_dim


def _truncate(text: str, max_words: int = 6000) -> str:
    words = text.split()
    return " ".join(words[:max_words]) if len(words) > max_words else text
