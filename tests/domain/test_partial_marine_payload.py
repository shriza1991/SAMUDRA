"""Regression tests for P0-3: Partial marine payload handling in risk evaluation.

Verifies:
1. Partial marine payload does not raise an uncaught Pydantic ValidationError.
2. Missing harbor does not fabricate a harbor (remains None).
3. Missing observed_at / valid_to does not fabricate timestamps (remains None).
4. Missing critical marine measurement still triggers existing safety behavior (UNKNOWN).
5. Existing caution scenario remains CAUTION.
6. Existing calm GO scenario remains GO when all genuinely required environmental evidence is present.
7. Graph specialist_tools_node robustly extracts partial marine dictionaries without crashing.
"""

import pytest
from backend.app.agents.graph import specialist_tools_node, run_orca_graph
from backend.app.agents.integrations.contracts import ToolInvocationContext, ToolOwner
from backend.app.agents.integrations.dev2 import (
    HazardBulletinPayload,
    MarineConditionsPayload,
    WeatherConditionsPayload,
)
from backend.app.agents.integrations.mocks import register_m2_contract_mocks
from backend.app.agents.tools import ToolDefinition, tool_registry
from backend.app.contracts.chat import (
    ConfidenceLevel,
    EvidenceItem,
    RecommendationStatus,
)
from backend.app.contracts.observation import ObservationBundle
from backend.app.contracts.tools import ToolResult, ToolStatus
from backend.app.domain.risk_engine import DeterministicRiskEngine


@pytest.fixture(autouse=True)
def reset_mocks():
    """Ensure clean contract mocks before and after each test."""
    register_m2_contract_mocks(tool_registry, override=True)
    yield
    register_m2_contract_mocks(tool_registry, override=True)


def test_partial_marine_payload_no_uncaught_validation_error():
    """1. Partial marine payload dictionary missing harbor/timestamps must instantiate without ValidationError."""
    partial_data = {
        "significant_wave_height_m": 0.9,
        "swell_period_sec": 7.0,
        "surface_current_knots": 0.8,
    }
    # Direct model construction must not crash
    payload = MarineConditionsPayload(**partial_data)
    assert payload.significant_wave_height_m == 0.9
    assert payload.swell_period_sec == 7.0
    assert payload.surface_current_knots == 0.8


def test_missing_harbor_does_not_fabricate_harbor():
    """2. Missing harbor must remain None and never be fabricated or defaulted to a fake port."""
    payload = MarineConditionsPayload(significant_wave_height_m=1.0)
    assert payload.harbor is None


def test_missing_timestamps_do_not_fabricate_timestamps():
    """3. Missing observed_at and valid_to must remain None without substituting current time."""
    payload = MarineConditionsPayload(significant_wave_height_m=1.0)
    assert payload.observed_at is None
    assert payload.valid_to is None


def test_missing_critical_marine_measurement_triggers_unknown():
    """4. Missing critical environmental measurement (significant_wave_height_m=None) must produce UNKNOWN."""
    context = ToolInvocationContext(origin_harbor="Ratnagiri", craft_profile="motorized_boat")
    # Payload with wave height missing
    marine = MarineConditionsPayload(significant_wave_height_m=None)
    weather = WeatherConditionsPayload(wind_speed_knots=10.0)
    hazard = HazardBulletinPayload(cyclone_warning_active=False, squall_alert=False)

    bundle = ObservationBundle(
        marine=marine,
        weather=weather,
        hazard=hazard,
        data_mode="SYNTHETIC",
    )
    result = DeterministicRiskEngine.evaluate(context, bundle=bundle)
    assert result.status == RecommendationStatus.UNKNOWN
    assert any("significant_wave_height_m" in str(f) or "missing" in str(f).lower() for f in result.decisive_factors)


def test_existing_caution_scenario_remains_caution():
    """5. Existing caution scenario (e.g. 1.6m wave height for motorized boat) evaluates as CAUTION."""
    context = ToolInvocationContext(origin_harbor="Ratnagiri", craft_profile="motorized_boat")
    marine = MarineConditionsPayload(
        significant_wave_height_m=1.6,
        swell_period_sec=9.0,
        surface_current_knots=1.2,
    )
    weather = WeatherConditionsPayload(
        wind_speed_knots=12.0,
        wind_gust_knots=15.0,
        visibility_km=10.0,
    )
    hazard = HazardBulletinPayload(
        cyclone_warning_active=False,
        squall_alert=False,
    )

    bundle = ObservationBundle(
        marine=marine,
        weather=weather,
        hazard=hazard,
        data_mode="SYNTHETIC",
    )
    result = DeterministicRiskEngine.evaluate(context, bundle=bundle)
    assert result.status == RecommendationStatus.CAUTION
    assert any("Moderate wave height 1.6m" in f for f in result.decisive_factors)


def test_existing_calm_go_scenario_remains_go():
    """6. Existing calm sea-state departure scenario with 0.9m waves evaluates as GO."""
    context = ToolInvocationContext(origin_harbor="Ratnagiri", craft_profile="motorized_boat")
    marine = MarineConditionsPayload(
        significant_wave_height_m=0.9,
        swell_period_sec=7.0,
        surface_current_knots=0.8,
    )
    weather = WeatherConditionsPayload(
        wind_speed_knots=10.0,
        wind_gust_knots=14.0,
        visibility_km=10.0,
    )
    hazard = HazardBulletinPayload(
        cyclone_warning_active=False,
        squall_alert=False,
    )

    bundle = ObservationBundle(
        marine=marine,
        weather=weather,
        hazard=hazard,
        data_mode="SYNTHETIC",
    )
    result = DeterministicRiskEngine.evaluate(context, bundle=bundle)
    assert result.status == RecommendationStatus.GO
    assert any("0.9m" in f for f in result.decisive_factors)


def test_specialist_tools_node_handles_partial_marine_dict():
    """7. specialist_tools_node constructs valid ObservationBundle from partial tool_results dict without crashing."""
    mock_state = {
        "user_message": "Can we sail from Ratnagiri?",
        "task_plan": ["risk_evaluation"],
        "origin_harbor": "Ratnagiri",
        "craft_type": "motorized_boat",
        "tool_results": {
            "marine_conditions": {
                "significant_wave_height_m": 0.9,
                "swell_period_sec": 7.0,
                "sea_surface_current_knots": 0.8,
                # harbor, observed_at, valid_to omitted
            },
            "weather_conditions": {
                "wind_speed_knots": 10.0,
            },
            "hazard_search": {
                "cyclone_warning_active": False,
                "squall_alert": False,
            },
        },
        "observation_bundle": None,
    }

    result = specialist_tools_node(mock_state)
    bundle = result.get("observation_bundle")
    assert bundle is not None
    assert bundle.marine is not None
    assert bundle.marine.significant_wave_height_m == 0.9
    assert bundle.marine.surface_current_knots == 0.8
    assert bundle.marine.harbor is None
    assert bundle.marine.observed_at is None
    assert bundle.marine.valid_to is None
    # Risk evaluation must be present and result in GO
    assert "risk_evaluation" in result["tool_results"]
    assert result.get("risk_assessment") is not None
    assert result["risk_assessment"].status == RecommendationStatus.GO
