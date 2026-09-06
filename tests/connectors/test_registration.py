"""Dev 2 Registration Integration Tests.

Owned by Dev 2 (Backend Platform).
"""

import pytest

from backend.app.agents.integrations.contracts import ToolErrorCode
from backend.app.agents.tools import AgentToolRegistry
from backend.app.connectors.manager import ConnectorManager
from backend.app.connectors.modes import DataMode
from backend.app.connectors.snapshot import SnapshotConnector
from backend.app.connectors.registration import register_dev2_provider_tools
from backend.app.contracts.tools import ToolStatus


@pytest.fixture
def snapshot_manager():
    """Returns a ConnectorManager using SNAPSHOT mode."""
    snapshot_connector = SnapshotConnector()
    return ConnectorManager(mode=DataMode.SNAPSHOT, snapshot_connector=snapshot_connector)


@pytest.fixture
def registry():
    """Returns a fresh AgentToolRegistry."""
    registry = AgentToolRegistry()
    registry.clear()
    return registry


def test_register_dev2_provider_tools(registry, snapshot_manager):
    """Test idempotency and successful registration of Dev 2 provider tools."""
    register_dev2_provider_tools(registry, snapshot_manager)

    assert registry.is_capability_available("marine_conditions")
    assert registry.is_capability_available("weather_conditions")
    assert registry.is_capability_available("hazard_search")

    assert registry.get_tool("marine_conditions") is not None
    assert registry.get_tool("weather_conditions") is not None
    assert registry.get_tool("hazard_search") is not None

    # Idempotent registration should not fail
    register_dev2_provider_tools(registry, snapshot_manager)


def test_marine_conditions_tool_execution(registry, snapshot_manager):
    register_dev2_provider_tools(registry, snapshot_manager)

    # 1. Test missing context
    result = registry.execute_tool("marine_conditions", params={})
    assert result.status == ToolStatus.FAILED
    assert result.error_code == ToolErrorCode.MISSING_CONTEXT.value

    # 2. Test successful execution (via snapshot)
    result = registry.execute_tool(
        "marine_conditions", params={"origin_harbor": "Ratnagiri"}
    )
    if result.status != ToolStatus.OK:
        print(f"FAILED: {result.error_code} - {result.warnings}")
    assert result.status == ToolStatus.OK
    assert "significant_wave_height_m" in result.data

    # Verify evidence and quality flags
    assert len(result.evidence) > 0
    ev = result.evidence[0]
    assert ev.metric_name == "significant_wave_height"
    assert "REAL_SOURCE" in ev.quality_flags
    assert "OFFICIAL" in ev.quality_flags


def test_weather_conditions_tool_execution(registry, snapshot_manager):
    register_dev2_provider_tools(registry, snapshot_manager)

    result = registry.execute_tool(
        "weather_conditions", params={"origin_harbor": "Ratnagiri"}
    )
    assert result.status == ToolStatus.OK
    assert "wind_speed_knots" in result.data

    assert len(result.evidence) > 0
    ev = result.evidence[0]
    assert ev.metric_name == "wind_speed_knots"
    assert "REAL_SOURCE" in ev.quality_flags


def test_hazard_search_tool_execution(registry, snapshot_manager):
    register_dev2_provider_tools(registry, snapshot_manager)

    result = registry.execute_tool(
        "hazard_search", params={"origin_harbor": "Ratnagiri"}
    )
    assert result.status == ToolStatus.OK
    assert "cyclone_warning_active" in result.data

    assert len(result.evidence) > 0
    ev = result.evidence[0]
    assert ev.metric_name == "cyclone_warning_active"
    assert "REAL_SOURCE" in ev.quality_flags
