"""Knowledge base lifecycle — seed loading and corpus management."""

import asyncio
import hashlib
import json
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.knowledge_chunk import KnowledgeChunk

logger = logging.getLogger(__name__)
settings = get_settings()


async def chunk_count(db: AsyncSession) -> int:
    """Return the total number of active knowledge chunks."""
    result = await db.execute(
        select(func.count(KnowledgeChunk.id)).where(KnowledgeChunk.deleted_at.is_(None))
    )
    return result.scalar_one()


async def load_seed(db: AsyncSession, seed_path: str) -> int:
    """Load pre-embedded chunks from a JSONL seed file.

    Each line: {content, embedding, source_type, source_name, metadata, token_count}
    Uses content_hash for idempotent upsert — skips duplicates.
    Returns count of newly inserted rows.
    """
    existing = await _existing_hashes(db)
    inserted = 0

    with open(seed_path) as f:
        for line in f:
            row = json.loads(line)
            content_hash = row.get("content_hash") or _hash(row["content"])
            if content_hash in existing:
                continue
            db.add(KnowledgeChunk(
                content=row["content"],
                embedding=row["embedding"],
                source_type=row.get("source_type", "corpus"),
                source_name=row.get("source_name"),
                content_hash=content_hash,
                metadata_json=row.get("metadata"),
                token_count=row.get("token_count"),
            ))
            existing.add(content_hash)
            inserted += 1
            if inserted % 500 == 0:
                await db.flush()
                logger.info("  Loaded %d chunks...", inserted)

    await db.commit()
    logger.info("Seed load complete: %d new chunks inserted", inserted)
    return inserted


async def load_from_hf(db: AsyncSession, dataset_id: str, split: str = "train") -> int:
    """Load a HuggingFace dataset, embed on the fly, and insert.

    Intended for smaller datasets like SFT Q&A pairs.
    """
    from datasets import load_dataset

    from app.services import embedding_service

    token = settings.hf_token or None
    ds = await asyncio.to_thread(load_dataset, dataset_id, split=split, token=token)
    existing = await _existing_hashes(db)
    texts = [row.get("text") or row.get("content") or row.get("question", "") for row in ds]
    embeddings = await embedding_service.embed_texts(texts)

    inserted = 0
    for i, row in enumerate(ds):
        text = texts[i]
        content_hash = _hash(text)
        if content_hash in existing:
            continue
        db.add(KnowledgeChunk(
            content=text,
            embedding=embeddings[i],
            source_type="sft_qa",
            source_name=dataset_id,
            content_hash=content_hash,
            metadata_json={k: v for k, v in dict(row).items() if k != "text"},
        ))
        existing.add(content_hash)
        inserted += 1
        if inserted % 500 == 0:
            await db.flush()

    await db.commit()
    logger.info("HF load complete: %d new chunks from %s", inserted, dataset_id)
    return inserted


async def load_seed_from_hf(db: AsyncSession, repo_id: str | None = None) -> int:
    """Download seed JSONL from HuggingFace Hub and load into pgvector.

    Downloads to a temp file, then delegates to ``load_seed`` for insert.
    """
    from huggingface_hub import hf_hub_download

    repo_id = repo_id or settings.rag_seed_hf_dataset
    token = settings.hf_token or None
    logger.info("Downloading seed from HF: %s", repo_id)
    local_path = await asyncio.to_thread(
        hf_hub_download,
        repo_id=repo_id,
        filename="knowledge_seed.jsonl",
        repo_type="dataset",
        token=token,
    )
    logger.info("Seed downloaded to %s", local_path)
    return await load_seed(db, local_path)


async def _existing_hashes(db: AsyncSession) -> set[str]:
    """Fetch all content_hash values for dedup."""
    result = await db.execute(
        select(KnowledgeChunk.content_hash).where(KnowledgeChunk.deleted_at.is_(None))
    )
    return {row[0] for row in result.all()}


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()
