"""Pending action service — create, confirm, reject, expire."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pending_action import ActionStatus, PendingAction
from app.services import (
    apiary_service,
    event_service,
    harvest_service,
    hive_service,
    inspection_service,
    task_service,
    treatment_service,
)


async def create_pending_action(
    db: AsyncSession,
    user_id: UUID,
    action_type: str,
    resource_type: str,
    payload: dict,
    summary: str,
    conversation_id: UUID | None = None,
) -> PendingAction:
    """Create a pending action awaiting user confirmation."""
    action = PendingAction(
        user_id=user_id,
        conversation_id=conversation_id,
        action_type=action_type,
        resource_type=resource_type,
        payload=payload,
        summary=summary,
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


async def get_action(
    db: AsyncSession,
    action_id: UUID,
) -> PendingAction | None:
    """Get a pending action by ID."""
    return await db.get(PendingAction, action_id)


async def get_pending_actions(
    db: AsyncSession,
    user_id: UUID,
) -> list[PendingAction]:
    """List pending actions for a user."""
    result = await db.execute(
        select(PendingAction)
        .where(
            PendingAction.user_id == user_id,
            PendingAction.status == ActionStatus.pending,
        )
        .order_by(PendingAction.created_at.desc())
    )
    return list(result.scalars().all())


async def confirm_action(
    db: AsyncSession,
    action_id: UUID,
    user_id: UUID,
) -> tuple[PendingAction, object | None]:
    """Confirm and execute a pending action.

    Returns (action, created_resource) or raises ValueError.
    """
    action = await db.get(PendingAction, action_id)
    if not action or action.user_id != user_id:
        raise ValueError("Action not found")
    if action.status != ActionStatus.pending:
        raise ValueError(f"Action already {action.status.value}")
    if action.expires_at < datetime.now(UTC):
        action.status = ActionStatus.expired
        await db.commit()
        raise ValueError("Action has expired")

    executor = _EXECUTORS.get(action.action_type)
    if not executor:
        raise ValueError(f"Unknown action type: {action.action_type}")

    resource = await executor(db, action.payload, user_id)
    action.status = ActionStatus.confirmed
    action.executed_at = datetime.now(UTC)
    if hasattr(resource, "id"):
        action.result_id = resource.id
    await db.commit()
    await db.refresh(action)
    return action, resource


async def reject_action(
    db: AsyncSession,
    action_id: UUID,
    user_id: UUID,
) -> PendingAction:
    """Reject a pending action."""
    action = await db.get(PendingAction, action_id)
    if not action or action.user_id != user_id:
        raise ValueError("Action not found")
    if action.status != ActionStatus.pending:
        raise ValueError(f"Action already {action.status.value}")
    action.status = ActionStatus.rejected
    await db.commit()
    await db.refresh(action)
    return action


async def expire_stale_actions(db: AsyncSession) -> int:
    """Bulk-expire actions past their expiry time. Returns count expired."""
    result = await db.execute(
        select(PendingAction).where(
            PendingAction.status == ActionStatus.pending,
            PendingAction.expires_at < datetime.now(UTC),
        )
    )
    actions = list(result.scalars().all())
    for a in actions:
        a.status = ActionStatus.expired
    if actions:
        await db.commit()
    return len(actions)


# ---------------------------------------------------------------------------
# Action executors — dispatch confirmed actions to the appropriate service
# ---------------------------------------------------------------------------


async def _exec_create_inspection(db: AsyncSession, payload: dict, user_id: UUID):
    return await inspection_service.create_inspection(db, payload)


async def _exec_update_inspection(db: AsyncSession, payload: dict, user_id: UUID):
    inspection_id = UUID(payload.pop("inspection_id"))
    inspection = await inspection_service.get_inspection(db, inspection_id, user_id)
    if not inspection:
        raise ValueError("Inspection not found")
    return await inspection_service.update_inspection(db, inspection, payload)


async def _exec_delete_inspection(db: AsyncSession, payload: dict, user_id: UUID):
    inspection_id = UUID(payload["inspection_id"])
    inspection = await inspection_service.get_inspection(db, inspection_id, user_id)
    if not inspection:
        raise ValueError("Inspection not found")
    await inspection_service.delete_inspection(db, inspection)
    return inspection


async def _exec_create_harvest(db: AsyncSession, payload: dict, user_id: UUID):
    return await harvest_service.create_harvest(db, payload)


async def _exec_update_harvest(db: AsyncSession, payload: dict, user_id: UUID):
    harvest_id = UUID(payload.pop("harvest_id"))
    harvest = await harvest_service.get_harvest(db, harvest_id, user_id)
    if not harvest:
        raise ValueError("Harvest not found")
    return await harvest_service.update_harvest(db, harvest, payload)


async def _exec_create_treatment(db: AsyncSession, payload: dict, user_id: UUID):
    return await treatment_service.create_treatment(db, payload)


async def _exec_update_treatment(db: AsyncSession, payload: dict, user_id: UUID):
    treatment_id = UUID(payload.pop("treatment_id"))
    treatment = await treatment_service.get_treatment(db, treatment_id, user_id)
    if not treatment:
        raise ValueError("Treatment not found")
    return await treatment_service.update_treatment(db, treatment, payload)


async def _exec_create_event(db: AsyncSession, payload: dict, user_id: UUID):
    return await event_service.create_event(db, payload)


async def _exec_create_task(db: AsyncSession, payload: dict, user_id: UUID):
    return await task_service.create_task(db, payload, user_id)


async def _exec_update_task(db: AsyncSession, payload: dict, user_id: UUID):
    task_id = UUID(payload.pop("task_id"))
    task = await task_service.get_task(db, task_id, user_id)
    if not task:
        raise ValueError("Task not found")
    return await task_service.update_task(db, task, payload)


async def _exec_complete_task(db: AsyncSession, payload: dict, user_id: UUID):
    task_id = UUID(payload["task_id"])
    task = await task_service.get_task(db, task_id, user_id)
    if not task:
        raise ValueError("Task not found")
    return await task_service.update_task(db, task, {"completed_at": datetime.now(UTC)})


async def _exec_delete_task(db: AsyncSession, payload: dict, user_id: UUID):
    task_id = UUID(payload["task_id"])
    task = await task_service.get_task(db, task_id, user_id)
    if not task:
        raise ValueError("Task not found")
    await task_service.delete_task(db, task)
    return task


async def _exec_create_apiary(db: AsyncSession, payload: dict, user_id: UUID):
    return await apiary_service.create_apiary(db, payload, user_id)


async def _exec_update_apiary(db: AsyncSession, payload: dict, user_id: UUID):
    apiary_id = UUID(payload.pop("apiary_id"))
    apiary = await apiary_service.get_apiary(db, apiary_id)
    if not apiary or apiary.user_id != user_id:
        raise ValueError("Apiary not found")
    return await apiary_service.update_apiary(db, apiary, payload)


async def _exec_create_hive(db: AsyncSession, payload: dict, user_id: UUID):
    return await hive_service.create_hive(db, payload)


async def _exec_update_hive(db: AsyncSession, payload: dict, user_id: UUID):
    hive_id = UUID(payload.pop("hive_id"))
    hive = await hive_service.get_hive(db, hive_id, user_id)
    if not hive:
        raise ValueError("Hive not found")
    return await hive_service.update_hive(db, hive, payload)


_EXECUTORS = {
    "create_inspection": _exec_create_inspection,
    "update_inspection": _exec_update_inspection,
    "delete_inspection": _exec_delete_inspection,
    "create_harvest": _exec_create_harvest,
    "update_harvest": _exec_update_harvest,
    "create_treatment": _exec_create_treatment,
    "update_treatment": _exec_update_treatment,
    "create_event": _exec_create_event,
    "create_task": _exec_create_task,
    "update_task": _exec_update_task,
    "complete_task": _exec_complete_task,
    "delete_task": _exec_delete_task,
    "create_apiary": _exec_create_apiary,
    "update_apiary": _exec_update_apiary,
    "create_hive": _exec_create_hive,
    "update_hive": _exec_update_hive,
}
