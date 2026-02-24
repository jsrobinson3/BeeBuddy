"""Task schemas."""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TaskSource(StrEnum):
    """How the task was created."""

    MANUAL = "manual"
    AI_RECOMMENDED = "ai_recommended"
    SYSTEM = "system"


class TaskPriority(StrEnum):
    """Task priority levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskCreate(BaseModel):
    """Request model for creating a task."""

    hive_id: UUID | None = None
    apiary_id: UUID | None = None
    title: str
    description: str | None = None
    due_date: date | None = None
    recurring: bool = False
    recurrence_rule: str | None = None
    source: TaskSource = TaskSource.MANUAL
    priority: TaskPriority = TaskPriority.MEDIUM


class TaskUpdate(BaseModel):
    """Request model for updating a task. All fields optional."""

    hive_id: UUID | None = None
    apiary_id: UUID | None = None
    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    recurring: bool | None = None
    recurrence_rule: str | None = None
    source: TaskSource | None = None
    completed_at: datetime | None = None
    priority: TaskPriority | None = None


class TaskResponse(BaseModel):
    """Response model for a task."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    hive_id: UUID | None = None
    apiary_id: UUID | None = None
    title: str
    description: str | None = None
    due_date: date | None = None
    recurring: bool = False
    recurrence_rule: str | None = None
    source: TaskSource
    completed_at: datetime | None = None
    priority: TaskPriority
    created_at: datetime
