"""Knowledge chunk — vector-embedded text for RAG retrieval."""

from pgvector.sqlalchemy import Vector
from sqlalchemy import Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

EMBEDDING_DIM = 768


class KnowledgeChunk(Base):
    """A chunk of beekeeping knowledge with its embedding vector."""

    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index(
            "ix_knowledge_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 200},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_knowledge_chunks_hash", "content_hash", unique=True),
        Index("ix_knowledge_chunks_source_type", "source_type"),
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(EMBEDDING_DIM), nullable=False)
    source_type: Mapped[str] = mapped_column(
        String(64), nullable=False,
    )  # "corpus" | "sft_qa"
    source_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, nullable=True,
    )
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
