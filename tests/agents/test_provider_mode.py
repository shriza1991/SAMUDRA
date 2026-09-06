"""Tests for the provider execution mode in the agent graph.

Owned by Dev 3. Ensures provider mode does not use M2 mocks or M1 stubs.
"""

import pytest

from backend.app.agents.graph import supervisor_node
from backend.app.agents.tools import tool_registry, ToolDefinition
from backend.app.contracts.chat import RecommendationStatus
from backend.app.contracts.tools import ToolResult, ToolStatus
from backend.app.agents.intent import IntentCategory
from backend.app.agents.integrations.contracts import ToolOwner


@pytest.fixture
def mock_provider_registry():
    """Sets up the global registry with a fake provider tool."""
    tool_registry.clear()
    
    # Fake marine_conditions tool that acts like a Dev 2 provider
    marine_def = ToolDefinition(
        name="marine_conditions",
        description="Fake marine conditions",
        category="marine",
        owner=ToolOwner.DEV2,
        capability="marine_conditions",
        required_context_fields=["origin_harbor"],
    )
    
    def fake_marine_handler(**kwargs):
        return ToolResult(
            status=ToolStatus.OK,
            data={"significant_wave_height_m": 1.5, "source_name": "Fake Provider"},
            evidence=[],
        )
    
    tool_registry.register_tool(marine_def, fake_marine_handler, override=True)
    tool_registry.set_capability_availability("marine_conditions", True)
    
    # Fake PFZ tool (since pfz_search requires marine_conditions)
    pfz_def = ToolDefinition(
        name="pfz_search",
        description="Fake PFZ search",
        category="marine",
        owner=ToolOwner.DEV4,
        capability="pfz_search",
        required_context_fields=["origin_harbor"],
        dependencies=["marine_conditions"],
    )
    
    def fake_pfz_handler(**kwargs):
        return ToolResult(
            status=ToolStatus.OK,
            data={"ranked_candidates": []},
            evidence=[],
        )
        
    tool_registry.register_tool(pfz_def, fake_pfz_handler, override=True)
    tool_registry.set_capability_availability("pfz_search", True)
    
    yield tool_registry
    
    tool_registry.clear()


def test_provider_mode_supervisor_node(mock_provider_registry):
    """Verifies that tool_mode='provider' builds the correct capability-based task plan."""
    initial_state = {
        "intent": IntentCategory.PFZ.value,
        "tool_mode": "provider",
        "user_message": "Where is the nearest fishing zone?",
    }
    
    # Run the supervisor node directly
    result = supervisor_node(initial_state)
    
    # The task plan should include the dependencies and the primary tool
    assert "task_plan" in result
    assert "marine_conditions" in result["task_plan"]
    assert "pfz_search" in result["task_plan"]
    
    # Ensure M2 contract mocks weren't explicitly registered (only happens in run_orca_graph, but good to verify registry state)
    assert tool_registry.get_tool("hazard_search") is None


def test_provider_mode_missing_capability_fails_safely():
    """Verifies that if a required capability is missing, provider mode supervisor handles it gracefully."""
    tool_registry.clear()
    
    initial_state = {
        "intent": IntentCategory.SAFETY.value,
        "tool_mode": "provider",
        "user_message": "Is it safe to leave Ratnagiri?",
        "origin_harbor": "Ratnagiri",
    }
    
    result = supervisor_node(initial_state)
    
    # Should flag a capability error with the name of the missing capability
    assert "capability_error" in result
    assert result["capability_error"] == "marine_conditions"
    
    # Task plan should be empty because it aborted
    assert result["task_plan"] == []
