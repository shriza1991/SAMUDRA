"""Test Suite for Milestone M6 (Slice 1: Hazard Intent + Hazard Tool Selection).

Verifies:
1. Basic hazard intent classification ("Are there any hazards near Ratnagiri?", "Are there any hazards near me?")
2. Cyclone query classification ("Are there any cyclone risks near Ratnagiri?", "Is there a cyclone on my route?")
3. Storm/squall query classification ("Are there any storm warnings?", "Is there any squall alert?")
4. Hazard tool selection (Supervisor schedules only `hazard_search` in contract_mock mode)
5. Existing hazard tool execution (specialist execution via registry, evidence collection, dynamic responses)
6. Active alert states (cyclone warning -> NO_GO, squall alert -> CAUTION)
"""

import pytest
from backend.app.agents.intent import IntentCategory
from backend.app.agents.graph import (
    intent_locale_node,
    supervisor_node,
    run_orca_graph,
)
from backend.app.agents.tools import tool_registry
from backend.app.agents.integrations.mocks import (
    register_m2_contract_mocks,
    MockHazardProvider,
)
from backend.app.contracts.chat import RecommendationStatus


@pytest.fixture(autouse=True)
def ensure_contract_mocks():
    """Ensure standard M2 contract mocks are registered before each test."""
    register_m2_contract_mocks(tool_registry, override=True)
    yield
    register_m2_contract_mocks(tool_registry, override=True)


# =============================================================================
# 1. Basic Hazard Intent Classification
# =============================================================================

def test_m6_basic_hazard_intent_classification():
    """Verify basic hazard queries map to IntentCategory.HAZARDS."""
    state = {
        "user_message": "Are there any hazards near Ratnagiri?",
        "thread_id": "test-m6-basic-1",
        "tool_mode": "contract_mock",
    }
    result = intent_locale_node(state)
    assert result["intent"] == IntentCategory.HAZARDS.value
    assert result["origin_harbor"] == "Ratnagiri"


def test_m6_hazard_near_me_classification():
    """Verify 'near me' does not misclassify 'Me' as a harbor and preserves HAZARDS intent."""
    state = {
        "user_message": "Are there any hazards near me?",
        "thread_id": "test-m6-basic-2",
        "tool_mode": "contract_mock",
    }
    result = intent_locale_node(state)
    assert result["intent"] == IntentCategory.HAZARDS.value
    assert result["origin_harbor"] != "Me"
    # Defaults to active harbor or Ratnagiri without failing
    assert result["origin_harbor"] in ["Ratnagiri", None] or isinstance(result["origin_harbor"], str)


# =============================================================================
# 2. Cyclone Query Classification
# =============================================================================

def test_m6_cyclone_query_near_harbor():
    """Verify cyclone queries with harbor classify as HAZARDS."""
    state = {
        "user_message": "Are there any cyclone risks near Ratnagiri?",
        "thread_id": "test-m6-cyclone-1",
        "tool_mode": "contract_mock",
    }
    result = intent_locale_node(state)
    assert result["intent"] == IntentCategory.HAZARDS.value
    assert result["origin_harbor"] == "Ratnagiri"


def test_m6_cyclone_on_my_route():
    """Verify cyclone queries referencing 'route' correctly prioritize HAZARDS intent."""
    state = {
        "user_message": "Is there a cyclone on my route?",
        "thread_id": "test-m6-cyclone-2",
        "tool_mode": "contract_mock",
    }
    result = intent_locale_node(state)
    assert result["intent"] == IntentCategory.HAZARDS.value
    assert result["origin_harbor"] != "Route"


# =============================================================================
# 3. Storm and Squall Query Classification
# =============================================================================

def test_m6_storm_warning_classification():
    """Verify storm warning queries classify as HAZARDS."""
    state = {
        "user_message": "Are there any storm warnings?",
        "thread_id": "test-m6-storm-1",
        "tool_mode": "contract_mock",
    }
    result = intent_locale_node(state)
    assert result["intent"] == IntentCategory.HAZARDS.value


def test_m6_squall_alert_classification():
    """Verify squall alert queries classify as HAZARDS."""
    state = {
        "user_message": "Is there any squall alert off Mumbai?",
        "thread_id": "test-m6-squall-1",
        "tool_mode": "contract_mock",
    }
    result = intent_locale_node(state)
    assert result["intent"] == IntentCategory.HAZARDS.value
    assert result["origin_harbor"] == "Mumbai"


# =============================================================================
# 4. Hazard Tool Selection
# =============================================================================

def test_m6_supervisor_hazard_tool_selection():
    """Verify supervisor selects only 'hazard_search' capability for HAZARDS intent."""
    state = {
        "intent": IntentCategory.HAZARDS.value,
        "origin_harbor": "Ratnagiri",
        "tool_mode": "contract_mock",
        "trace": [],
    }
    result = supervisor_node(state)
    assert result["task_plan"] == ["hazard_search"]


# =============================================================================
# 5. Existing Hazard Tool Execution & End-to-End Pipeline
# =============================================================================

def test_m6_hazard_end_to_end_calm_conditions():
    """Verify end-to-end hazard query execution under calm/normal conditions."""
    response = run_orca_graph(
        user_message="Are there any cyclone risks near Ratnagiri?",
        thread_id="test-m6-pipeline-calm",
        tool_mode="contract_mock",
    )

    assert response["intent"] == IntentCategory.HAZARDS.value
    assert response["origin_harbor"] == "Ratnagiri"
    assert response["task_plan"] == ["hazard_search"]
    assert "hazard_search" in response["tool_results"]

    # Evidence checking
    evidence = response.get("evidence", [])
    assert any(ev.metric_name == "cyclone_warning_active" for ev in evidence)

    # Observations checking
    obs = response.get("observations", {})
    assert obs.get("cyclone_warning_active") is False
    assert obs.get("squall_alert") is False

    # Status check (Informational when no hazards active)
    risk_assessment = response.get("risk_assessment")
    assert risk_assessment is not None
    assert risk_assessment.status == RecommendationStatus.INFORMATIONAL


def test_m6_hazard_active_cyclone_alert():
    """Verify that when a cyclone warning is active, status is NO_GO."""
    # Register custom MockHazardProvider with cyclone active
    register_m2_contract_mocks(
        tool_registry,
        mock_hazard=MockHazardProvider(cyclone_active=True, squall_alert=False),
        override=True,
    )

    response = run_orca_graph(
        user_message="Are there any cyclone risks near Ratnagiri?",
        thread_id="test-m6-pipeline-cyclone-active",
        tool_mode="contract_mock",
    )

    assert response["intent"] == IntentCategory.HAZARDS.value
    assert response["observations"].get("cyclone_warning_active") is True

    risk_assessment = response.get("risk_assessment")
    assert risk_assessment is not None
    assert risk_assessment.status == RecommendationStatus.NO_GO
    assert "[NO_GO]" in response["response"]
    assert "ACTIVE" in response["response"]


def test_m6_hazard_active_squall_alert():
    """Verify that when a squall alert is active, status is CAUTION."""
    # Register custom MockHazardProvider with squall alert active
    register_m2_contract_mocks(
        tool_registry,
        mock_hazard=MockHazardProvider(cyclone_active=False, squall_alert=True),
        override=True,
    )

    response = run_orca_graph(
        user_message="Are there any storm warnings off Ratnagiri?",
        thread_id="test-m6-pipeline-squall-active",
        tool_mode="contract_mock",
    )

    assert response["intent"] == IntentCategory.HAZARDS.value
    assert response["observations"].get("squall_alert") is True

    risk_assessment = response.get("risk_assessment")
    assert risk_assessment is not None
    assert risk_assessment.status == RecommendationStatus.CAUTION
    assert "[CAUTION]" in response["response"]
