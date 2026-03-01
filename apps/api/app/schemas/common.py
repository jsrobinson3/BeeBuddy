"""Shared base schemas and utility models."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelBase(BaseModel):
    """Base model that serializes snake_case fields as camelCase."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BaseResponse(BaseModel):
    """Base response model with ORM mode and camelCase aliases."""

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )


class PaginationParams(CamelBase):
    """Standard pagination parameters."""

    offset: int = 0
    limit: int = 50


class ErrorResponse(CamelBase):
    """Standard error response."""

    detail: str
