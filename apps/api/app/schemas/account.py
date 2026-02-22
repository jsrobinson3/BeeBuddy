"""Account deletion schemas."""

from pydantic import BaseModel


class DeleteAccountRequest(BaseModel):
    """Request to delete account (requires password confirmation)."""

    password: str


class CancelDeletionRequest(BaseModel):
    """Request to cancel a pending account deletion."""

    token: str
