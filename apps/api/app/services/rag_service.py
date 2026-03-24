"""RAG retrieval service — pgvector cosine similarity search."""

import logging
import time

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.knowledge_chunk import KnowledgeChunk
from app.services import embedding_service

logger = logging.getLogger(__name__)
settings = get_settings()


def _build_search_query(query_vec: list[float], top_k: int):
    """Build the pgvector cosine similarity SELECT statement."""
    similarity = (1 - KnowledgeChunk.embedding.cosine_distance(query_vec)).label("similarity")
    return (
        select(
            KnowledgeChunk.content,
            KnowledgeChunk.source_name,
            KnowledgeChunk.source_type,
            KnowledgeChunk.metadata_json,
            similarity,
        )
        .where(KnowledgeChunk.deleted_at.is_(None))
        .order_by(KnowledgeChunk.embedding.cosine_distance(query_vec))
        .limit(top_k)
    )


async def search(
    db: AsyncSession,
    query: str,
    top_k: int | None = None,
    threshold: float | None = None,
) -> list[dict]:
    """Search knowledge base for chunks similar to the query."""
    top_k = top_k or settings.rag_top_k
    threshold = threshold if threshold is not None else settings.rag_similarity_threshold

    t0 = time.monotonic()
    query_vec = await embedding_service.embed_query(query)
    embed_ms = int((time.monotonic() - t0) * 1000)

    t1 = time.monotonic()
    result = await db.execute(_build_search_query(query_vec, top_k))
    rows = result.all()
    search_ms = int((time.monotonic() - t1) * 1000)

    chunks = [
        {
            "content": r.content, "source_name": r.source_name,
            "source_type": r.source_type, "metadata": r.metadata_json,
            "similarity": round(float(r.similarity), 4),
        }
        for r in rows if float(r.similarity) >= threshold
    ]

    logger.info(
        "RAG search: %d results (embed=%dms, search=%dms, top=%.3f)",
        len(chunks), embed_ms, search_ms,
        chunks[0]["similarity"] if chunks else 0.0,
    )
    return chunks


async def get_stats(db: AsyncSession) -> dict:
    """Return knowledge base statistics."""
    stmt = (
        select(
            KnowledgeChunk.source_type,
            func.count(KnowledgeChunk.id).label("count"),
        )
        .where(KnowledgeChunk.deleted_at.is_(None))
        .group_by(KnowledgeChunk.source_type)
    )
    result = await db.execute(stmt)
    by_type = {row.source_type: row.count for row in result.all()}

    total = sum(by_type.values())
    return {"total_chunks": total, "by_source_type": by_type}
