"""Tests for Shared Contract Schemas (ChatResponse, ToolResult).

Validates serialization, required fields, and enum constraints.
"""

import pytest
from pydantic import ValidationError

from backend.app.contracts.chat import (
    ChatRequest,
    ChatResponse,
    Confidence,
    ConfidenceLevel,
    EvidenceItem,
    MapLayer,
    Recommendation,
    RecommendationStatus,
    UserContext,
)
from backend.app.contracts.tools import ToolResult, ToolStatus


def test_valid_chat_response_serialization():
    """Ensure ChatResponse schema serializes without error."""
    resp = ChatResponse(
        run_id="run-12345",
        conversation_id="conv-67890",
        language="en",
        intent="GO_NO_GO_SAFETY",
        answer="Conditions are calm and safe for departure.",
        recommendation=Recommendation(
            status=RecommendationStatus.GO,
            summary="Wave height 0.8m, wind 10 kts.",
            decisive_factors=["Calm wave height", "No IMD alerts"],
            next_action="Proceed to sea with standard VHF watch.",
        ),
        confidence=Confidence(
            level=ConfidenceLevel.HIGH,
            reasons=["Fresh INCOIS forecast", "IMD bulletin synced"],
        ),
        evidence=[
            EvidenceItem(
                source_name="INCOIS Ocean State Forecast",
                retrieved_at="2026-09-05T00:00:00Z",
                metric_name="significant_wave_height",
                metric_value=0.8,
                metric_unit="meters",
                quality_flags=["fresh", "official_source"],
            )
        ],
        map_layers=[],
        trace=[],
        warnings=[],
        suggested_followups=["Where is the nearest PFZ?"],
    )

    data = resp.model_dump()
    assert data["recommendation"]["status"] == "GO"
    assert data["confidence"]["level"] == "HIGH"
    assert len(data["evidence"]) == 1
    assert data["evidence"][0]["metric_value"] == 0.8


def test_invalid_recommendation_status_raises_error():
    """Assert invalid recommendation status raises ValidationError."""
    with pytest.raises(ValidationError):
        Recommendation(
            status="MAYBE_SAFE",  # Invalid enum value
            summary="Invalid",
            decisive_factors=[],
            next_action="Wait",
        )


def test_tool_result_serialization():
    """Ensure ToolResult schema serializes properly."""
    tool_res = ToolResult(
        status=ToolStatus.OK,
        data={"distance_km": 24.5, "bearing_deg": 280.0},
        evidence=[],
        warnings=[],
    )
    dumped = tool_res.model_dump()
    assert dumped["status"] == "ok"
    assert dumped["data"]["distance_km"] == 24.5
