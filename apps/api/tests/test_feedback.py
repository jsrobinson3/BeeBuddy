"""Integration tests for AI message feedback endpoints."""

import pytest


async def _create_chat_conversation(client, headers) -> str | None:
    """Send a chat message and return the conversation ID, or None if LLM unavailable."""
    import httpx

    try:
        resp = await client.post(
            "/api/v1/ai/chat",
            headers=headers,
            json={"messages": [{"role": "user", "content": "Hello Buddy"}]},
            timeout=30.0,
        )
    except httpx.ReadTimeout:
        return None
    if resp.status_code != 200:
        return None

    resp = await client.get("/api/v1/ai/conversations", headers=headers)
    assert resp.status_code == 200
    convos = resp.json()
    return convos[0]["id"] if convos else None


async def _find_assistant_index(client, headers, conv_id: str) -> int | None:
    """Return the server-side index of the first assistant message."""
    resp = await client.get(f"/api/v1/ai/conversations/{conv_id}", headers=headers)
    assert resp.status_code == 200
    for i, msg in enumerate(resp.json()["messages"]):
        if msg["role"] == "assistant":
            return i
    return None


@pytest.fixture
async def conversation(auth_client):
    """Create a conversation with assistant messages for feedback testing."""
    client, headers = auth_client
    conv_id = await _create_chat_conversation(client, headers)
    if conv_id is None:
        pytest.skip("LLM not available for conversation creation")

    assistant_idx = await _find_assistant_index(client, headers, conv_id)
    assert assistant_idx is not None, "No assistant message found in conversation"
    return conv_id, assistant_idx


@pytest.mark.asyncio
async def test_submit_thumbs_up(auth_client, conversation):
    """Submit thumbs-up feedback on an assistant message."""
    client, headers = auth_client
    conv_id, msg_idx = conversation

    resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/messages/{msg_idx}/feedback",
        headers=headers,
        json={"rating": 1},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["rating"] == 1
    assert data["conversationId"] == conv_id
    assert data["messageIndex"] == msg_idx
    assert data["correction"] is None


@pytest.mark.asyncio
async def test_submit_thumbs_down_with_correction(auth_client, conversation):
    """Submit thumbs-down feedback with a correction."""
    client, headers = auth_client
    conv_id, msg_idx = conversation

    resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/messages/{msg_idx}/feedback",
        headers=headers,
        json={"rating": -1, "correction": "Should mention varroa treatment timing"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["rating"] == -1
    assert data["correction"] == "Should mention varroa treatment timing"


@pytest.mark.asyncio
async def test_upsert_changes_rating(auth_client, conversation):
    """Re-submitting feedback updates the existing entry."""
    client, headers = auth_client
    conv_id, msg_idx = conversation

    # Submit thumbs up
    resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/messages/{msg_idx}/feedback",
        headers=headers,
        json={"rating": 1},
    )
    assert resp.status_code == 200
    first_id = resp.json()["id"]

    # Change to thumbs down
    resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/messages/{msg_idx}/feedback",
        headers=headers,
        json={"rating": -1},
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == first_id  # Same record updated
    assert resp.json()["rating"] == -1


@pytest.mark.asyncio
async def test_get_conversation_feedback(auth_client, conversation):
    """List all feedback for a conversation."""
    client, headers = auth_client
    conv_id, msg_idx = conversation

    # Submit feedback first
    await client.post(
        f"/api/v1/ai/conversations/{conv_id}/messages/{msg_idx}/feedback",
        headers=headers,
        json={"rating": 1},
    )

    resp = await client.get(
        f"/api/v1/ai/conversations/{conv_id}/feedback",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["feedback"]) >= 1
    assert data["feedback"][0]["rating"] == 1


@pytest.mark.asyncio
async def test_delete_feedback(auth_client, conversation):
    """Delete feedback from a message."""
    client, headers = auth_client
    conv_id, msg_idx = conversation

    # Submit then delete
    await client.post(
        f"/api/v1/ai/conversations/{conv_id}/messages/{msg_idx}/feedback",
        headers=headers,
        json={"rating": 1},
    )
    resp = await client.delete(
        f"/api/v1/ai/conversations/{conv_id}/messages/{msg_idx}/feedback",
        headers=headers,
    )
    assert resp.status_code == 204

    # Verify it's gone
    resp = await client.get(
        f"/api/v1/ai/conversations/{conv_id}/feedback",
        headers=headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["feedback"]) == 0


@pytest.mark.asyncio
async def test_feedback_on_nonexistent_conversation(auth_client):
    """Feedback on a nonexistent conversation returns 404."""
    client, headers = auth_client
    fake_id = "00000000-0000-0000-0000-000000000000"

    resp = await client.post(
        f"/api/v1/ai/conversations/{fake_id}/messages/0/feedback",
        headers=headers,
        json={"rating": 1},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_feedback_on_user_message_rejected(auth_client, conversation):
    """Feedback on a user message (not assistant) returns 404."""
    client, headers = auth_client
    conv_id, _ = conversation

    # Index 0 is typically the first user message
    resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/messages/0/feedback",
        headers=headers,
        json={"rating": 1},
    )
    # User message at index 0 → should be rejected
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_feedback_invalid_rating(auth_client, conversation):
    """Rating outside -1/1 range is rejected by schema validation."""
    client, headers = auth_client
    conv_id, msg_idx = conversation

    resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/messages/{msg_idx}/feedback",
        headers=headers,
        json={"rating": 5},
    )
    assert resp.status_code == 422
