"""Pydantic schemas for WatermelonDB sync protocol."""

import math
from typing import Any

from pydantic import BaseModel, Field, field_validator


class TableChanges(BaseModel):
    """Changes for a single table in WatermelonDB sync format."""

    created: list[dict[str, Any]] = Field(default_factory=list)
    updated: list[dict[str, Any]] = Field(default_factory=list)
    deleted: list[str] = Field(default_factory=list)


class SyncPullRequest(BaseModel):
    """Request body for the pull endpoint."""

    last_pulled_at: float | None = Field(
        None,
        ge=0,
        description="Unix timestamp (ms) of last successful pull. None for first sync.",
    )
    schema_version: int = Field(1, description="Client schema version")
    migration: dict[str, Any] | None = Field(
        None, description="Migration info if schema changed"
    )

    @field_validator("last_pulled_at")
    @classmethod
    def validate_last_pulled_at(cls, v: float | None) -> float | None:
        if v is not None and not math.isfinite(v):
            raise ValueError("last_pulled_at must be a finite number")
        return v


class SyncPullResponse(BaseModel):
    """Response body for the pull endpoint."""

    changes: dict[str, TableChanges]
    timestamp: float = Field(description="Server timestamp (ms) for next pull")


class SyncPushRequest(BaseModel):
    """Request body for the push endpoint."""

    changes: dict[str, TableChanges]
    last_pulled_at: float = Field(
        ge=0,
        description="Unix timestamp (ms) of last successful pull",
    )

    @field_validator("last_pulled_at")
    @classmethod
    def validate_last_pulled_at(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("last_pulled_at must be a finite number")
        return v
