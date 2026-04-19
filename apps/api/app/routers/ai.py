"""AI chat endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.verified import get_verified_user
from app.db.session import get_db
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.ai import (
    ChatRequest,
    ConversationDetailResponse,
    ConversationResponse,
    PendingActionResponse,
)
from app.schemas.feedback import (
    ConversationFeedbackResponse,
    FeedbackCreate,
    FeedbackResponse,
)
from app.services import ai_service, feedback_service, pending_action_service, warmup_service

router = APIRouter(prefix="/ai")


@router.post("/chat")
@limiter.limit("10/minute")
async def chat(
    request: Request,
    data: ChatRequest,
    current_user: User = Depends(get_verified_user),
):
    """Stream a chat response from the beekeeping AI assistant.

    No ``db`` dependency here — ``stream_chat`` opens short-lived
    sessions per phase so the request doesn't hold a DB transaction
    across the LLM call.
    """
    return StreamingResponse(
        ai_service.stream_chat(current_user, data),
        media_type="text/event-stream",
    )


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all conversations for the current user."""
    return await ai_service.get_conversations(db, current_user.id)


MAX_DISPLAY_MESSAGES = 50


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
)
async def get_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a conversation with recent message history.

    Returns the last MAX_DISPLAY_MESSAGES messages for UI performance.
    The full history is kept in the DB for LLM context.
    """
    conv = await ai_service.get_conversation(db, conversation_id, current_user.id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # Cap messages sent to the client — full history stays in DB for LLM context
    if len(conv.messages) > MAX_DISPLAY_MESSAGES:
        db.expunge(conv)
        conv.messages = conv.messages[-MAX_DISPLAY_MESSAGES:]
    return conv


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a conversation."""
    deleted = await ai_service.delete_conversation(
        db, conversation_id, current_user.id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return Response(status_code=204)


@router.post("/warmup")
async def warmup(
    current_user: User = Depends(get_current_user),
):
    """Pre-warm HF Inference Endpoints (fire-and-forget from mobile)."""
    return await warmup_service.warm_endpoints()


@router.post(
    "/actions/{action_id}/confirm",
    response_model=PendingActionResponse,
)
async def confirm_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm and execute a pending action."""
    try:
        action, _resource = await pending_action_service.confirm_action(
            db, action_id, current_user.id,
        )
    except ValueError as e:
        status = 400
        if "not found" in str(e).lower():
            status = 404
        elif "already" in str(e).lower():
            status = 409
        raise HTTPException(status_code=status, detail=str(e))
    return action


@router.post("/actions/{action_id}/reject", status_code=204)
async def reject_action(
    action_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a pending action."""
    try:
        await pending_action_service.reject_action(
            db, action_id, current_user.id,
        )
    except ValueError as e:
        status = 400
        if "not found" in str(e).lower():
            status = 404
        raise HTTPException(status_code=status, detail=str(e))
    return Response(status_code=204)


@router.get(
    "/actions/pending",
    response_model=list[PendingActionResponse],
)
async def list_pending_actions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pending actions for the current user."""
    return await pending_action_service.get_pending_actions(
        db, current_user.id,
    )


# ── Feedback ──────────────────────────────────────────────────────────────


@router.post(
    "/conversations/{conversation_id}/messages/{message_index}/feedback",
    response_model=FeedbackResponse,
)
@limiter.limit("30/minute")
async def submit_feedback(
    request: Request,
    conversation_id: UUID,
    message_index: int,
    data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit or update feedback on an assistant message."""
    fb = await feedback_service.upsert_feedback(
        db, current_user.id, conversation_id, message_index,
        rating=data.rating, correction=data.correction,
    )
    if fb is None:
        raise HTTPException(status_code=404, detail="Conversation or message not found")
    return fb


@router.get(
    "/conversations/{conversation_id}/feedback",
    response_model=ConversationFeedbackResponse,
)
async def get_feedback(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all feedback for a conversation."""
    items = await feedback_service.get_conversation_feedback(
        db, current_user.id, conversation_id,
    )
    return ConversationFeedbackResponse(feedback=items)


@router.delete(
    "/conversations/{conversation_id}/messages/{message_index}/feedback",
    status_code=204,
)
async def delete_feedback(
    conversation_id: UUID,
    message_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove feedback from a message."""
    deleted = await feedback_service.delete_feedback(
        db, current_user.id, conversation_id, message_index,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return Response(status_code=204)
