"""Pydantic schemas for WatermelonDB sync protocol."""

from typing import Any

from pydantic import BaseModel, Field


class TableChanges(BaseModel):
    """Changes for a single table in WatermelonDB sync format."""

    created: list[dict[str, Any]] = Field(default_factory=list)
    updated: list[dict[str, Any]] = Field(default_factory=list)
    deleted: list[str] = Field(default_factory=list)


class SyncPullRequest(BaseModel):
    """Request body for the pull endpoint."""

    last_pulled_at: float | None = Field(
        None,
        description="Unix timestamp (ms) of last successful pull. None for first sync.",
    )
    schema_version: int = Field(1, description="Client schema version")
    migration: dict[str, Any] | None = Field(
        None, description="Migration info if schema changed"
    )


class SyncPullResponse(BaseModel):
    """Response body for the pull endpoint."""

    changes: dict[str, TableChanges]
    timestamp: float = Field(description="Server timestamp (ms) for next pull")


class SyncPushRequest(BaseModel):
    """Request body for the push endpoint."""

    changes: dict[str, TableChanges]
    last_pulled_at: float = Field(
        description="Unix timestamp (ms) of last successful pull"
    )
