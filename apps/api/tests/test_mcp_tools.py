"""Unit tests for app.services.mcp_tools — MCP tool server factory.

Tests verify that each tool correctly delegates to existing service functions
and serializes results to JSON-safe dicts.
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.mcp_tools import create_mcp_server

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_apiary(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "name": "Test Apiary",
        "hive_count": 3,
        "city": "Portland",
        "country_code": "US",
        "notes": None,
        "created_at": datetime(2025, 6, 1),
    }
    defaults.update(overrides)
    m = MagicMock()
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


def _mock_hive(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "apiary_id": uuid.uuid4(),
        "name": "Hive Alpha",
        "hive_type": MagicMock(value="langstroth"),
        "status": MagicMock(value="active"),
        "source": MagicMock(value="nuc"),
        "installation_date": None,
        "notes": None,
    }
    defaults.update(overrides)
    m = MagicMock()
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


def _mock_harvest(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "hive_id": uuid.uuid4(),
        "harvested_at": datetime(2025, 8, 15),
        "weight_kg": 12.5,
        "moisture_percent": 17.2,
        "honey_type": "wildflower",
        "flavor_notes": "Floral",
        "frames_harvested": 4,
        "notes": None,
    }
    defaults.update(overrides)
    m = MagicMock()
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


def _mock_inspection(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "hive_id": uuid.uuid4(),
        "inspected_at": datetime(2025, 7, 10),
        "duration_minutes": 30,
        "observations": {"brood": "good"},
        "weather": {"temp_c": 22},
        "impression": 4,
        "attention": False,
        "notes": "Healthy colony",
        "ai_summary": None,
    }
    defaults.update(overrides)
    m = MagicMock()
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


def _mock_queen(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "hive_id": uuid.uuid4(),
        "marking_color": "blue",
        "marking_year": 2024,
        "origin": MagicMock(value="purchased"),
        "status": MagicMock(value="present"),
        "race": "Italian",
        "quality": 4,
        "fertilized": True,
        "clipped": False,
        "birth_date": None,
        "introduced_date": None,
        "notes": None,
    }
    defaults.update(overrides)
    m = MagicMock()
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestListApiaries:
    @patch("app.services.mcp_tools.apiary_service")
    async def test_returns_serialized_apiaries(self, mock_svc):
        mock_svc.get_apiaries = AsyncMock(return_value=[_mock_apiary()])
        db = AsyncMock()
        user_id = uuid.uuid4()
        server = create_mcp_server(db, user_id)

        from fastmcp import Client

        async with Client(server) as client:
            result = await client.call_tool("list_apiaries", {})

        mock_svc.get_apiaries.assert_awaited_once_with(db, user_id)
        text = result.content[0].text
        assert "Test Apiary" in text
        assert "Portland" in text


class TestListHives:
    @patch("app.services.mcp_tools.hive_service")
    async def test_returns_hives(self, mock_svc):
        mock_svc.get_hives = AsyncMock(return_value=[_mock_hive()])
        db = AsyncMock()
        user_id = uuid.uuid4()
        server = create_mcp_server(db, user_id)

        from fastmcp import Client

        async with Client(server) as client:
            result = await client.call_tool("list_hives", {})

        mock_svc.get_hives.assert_awaited_once()
        assert "Hive Alpha" in result.content[0].text

    @patch("app.services.mcp_tools.hive_service")
    async def test_filters_by_apiary(self, mock_svc):
        apiary_id = uuid.uuid4()
        mock_svc.get_hives = AsyncMock(return_value=[])
        db = AsyncMock()
        user_id = uuid.uuid4()
        server = create_mcp_server(db, user_id)

        from fastmcp import Client

        async with Client(server) as client:
            await client.call_tool("list_hives", {"apiary_id": str(apiary_id)})

        call_kwargs = mock_svc.get_hives.call_args
        assert call_kwargs[1]["apiary_id"] == apiary_id


class TestGetHarvests:
    @patch("app.services.mcp_tools.harvest_service")
    async def test_returns_harvests(self, mock_svc):
        mock_svc.get_harvests = AsyncMock(return_value=[_mock_harvest()])
        db = AsyncMock()
        user_id = uuid.uuid4()
        server = create_mcp_server(db, user_id)

        from fastmcp import Client

        async with Client(server) as client:
            result = await client.call_tool("get_harvests", {})

        text = result.content[0].text
        assert "12.5" in text
        assert "wildflower" in text


class TestGetInspections:
    @patch("app.services.mcp_tools.inspection_service")
    async def test_returns_inspections(self, mock_svc):
        mock_svc.get_inspections = AsyncMock(return_value=[_mock_inspection()])
        db = AsyncMock()
        user_id = uuid.uuid4()
        server = create_mcp_server(db, user_id)

        from fastmcp import Client

        async with Client(server) as client:
            result = await client.call_tool("get_inspections", {"limit": 5})

        text = result.content[0].text
        assert "Healthy colony" in text

    @patch("app.services.mcp_tools.inspection_service")
    async def test_caps_limit(self, mock_svc):
        mock_svc.get_inspections = AsyncMock(return_value=[])
        db = AsyncMock()
        user_id = uuid.uuid4()
        server = create_mcp_server(db, user_id)

        from fastmcp import Client

        async with Client(server) as client:
            await client.call_tool("get_inspections", {"limit": 999})

        call_kwargs = mock_svc.get_inspections.call_args
        assert call_kwargs[1]["limit"] <= 50


class TestGetQueens:
    @patch("app.services.mcp_tools.queen_service")
    async def test_returns_queens(self, mock_svc):
        mock_svc.get_queens = AsyncMock(return_value=[_mock_queen()])
        db = AsyncMock()
        user_id = uuid.uuid4()
        server = create_mcp_server(db, user_id)

        from fastmcp import Client

        async with Client(server) as client:
            result = await client.call_tool("get_queens", {})

        text = result.content[0].text
        assert "Italian" in text
        assert "blue" in text


class TestGetHiveHealthSummary:
    @patch("app.services.mcp_tools.queen_service")
    @patch("app.services.mcp_tools.inspection_service")
    @patch("app.services.mcp_tools.hive_service")
    async def test_builds_summary(self, mock_hive_svc, mock_insp_svc, mock_queen_svc):
        hive = _mock_hive()
        mock_hive_svc.get_hives = AsyncMock(return_value=[hive])
        mock_insp_svc.get_inspections = AsyncMock(return_value=[_mock_inspection()])
        mock_queen_svc.get_queens = AsyncMock(return_value=[_mock_queen()])

        db = AsyncMock()
        user_id = uuid.uuid4()
        server = create_mcp_server(db, user_id)

        from fastmcp import Client

        async with Client(server) as client:
            result = await client.call_tool("get_hive_health_summary", {})

        text = result.content[0].text
        assert "Hive Alpha" in text
        assert "present" in text
