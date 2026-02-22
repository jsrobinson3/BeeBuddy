"""Shared base schemas and utility models."""

from pydantic import BaseModel, ConfigDict


class BaseResponse(BaseModel):
    """Base response model with ORM mode enabled."""

    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    """Standard pagination parameters."""

    offset: int = 0
    limit: int = 50


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str
