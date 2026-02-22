"""Pydantic schemas for request/response models."""

from .apiary import ApiaryCreate, ApiaryResponse, ApiaryUpdate
from .common import BaseResponse, ErrorResponse, PaginationParams
from .event import EventCreate, EventResponse, EventType, EventUpdate
from .harvest import HarvestCreate, HarvestResponse, HarvestUpdate
from .hive import (
    HiveCreate,
    HiveResponse,
    HiveSource,
    HiveStatus,
    HiveType,
    HiveUpdate,
)
from .inspection import (
    ExperienceLevel,
    InspectionCreate,
    InspectionObservations,
    InspectionResponse,
    InspectionUpdate,
    WeatherSnapshot,
)
from .queen import QueenCreate, QueenOrigin, QueenResponse, QueenStatus, QueenUpdate
from .task import (
    TaskCreate,
    TaskPriority,
    TaskResponse,
    TaskSource,
    TaskUpdate,
)
from .treatment import TreatmentCreate, TreatmentResponse, TreatmentUpdate
from .user import UserCreate, UserResponse, UserUpdate

__all__ = [
    # Common
    "BaseResponse",
    "ErrorResponse",
    "PaginationParams",
    # User
    "UserCreate",
    "UserResponse",
    "UserUpdate",
    # Apiary
    "ApiaryCreate",
    "ApiaryResponse",
    "ApiaryUpdate",
    # Hive
    "HiveCreate",
    "HiveResponse",
    "HiveSource",
    "HiveStatus",
    "HiveType",
    "HiveUpdate",
    # Inspection
    "ExperienceLevel",
    "InspectionCreate",
    "InspectionObservations",
    "InspectionResponse",
    "InspectionUpdate",
    "WeatherSnapshot",
    # Queen
    "QueenCreate",
    "QueenOrigin",
    "QueenResponse",
    "QueenStatus",
    "QueenUpdate",
    # Treatment
    "TreatmentCreate",
    "TreatmentResponse",
    "TreatmentUpdate",
    # Harvest
    "HarvestCreate",
    "HarvestResponse",
    "HarvestUpdate",
    # Event
    "EventCreate",
    "EventResponse",
    "EventType",
    "EventUpdate",
    # Task
    "TaskCreate",
    "TaskPriority",
    "TaskResponse",
    "TaskSource",
    "TaskUpdate",
]
