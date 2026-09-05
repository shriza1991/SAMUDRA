"""Canonical Chat Request and Response Contracts for SAMUDRA.

Owned by Dev 2 (Backend Platform), referenced by Dev 1, Dev 3, and Dev 4.
All changes to these models must follow the RFC process in docs/DEVELOPMENT.md.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RecommendationStatus(str, Enum):
    GO = "GO"
    CAUTION = "CAUTION"
    NO_GO = "NO_GO"
    UNKNOWN = "UNKNOWN"
    INFORMATIONAL = "INFORMATIONAL"


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class UserContext(BaseModel):
    origin_harbor: Optional[str] = Field(
        None, description="Departure landing center or harbor name (e.g., 'Ratnagiri')"
    )
    coordinates: Optional[List[float]] = Field(
        None, description="[longitude, latitude] pair in EPSG:4326"
    )
    craft_profile: Optional[str] = Field(
        "motorized_boat",
        description="Craft class: traditional_non_motorized | motorized_boat | mechanized_trawler",
    )
    language_preference: Optional[str] = Field(
        "auto", description="Preferred response language ISO code: auto | en | hi | mr | ta"
    )


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = Field(
        None, description="Client session UUID; generated server-side if null"
    )
    message: str = Field(..., min_length=1, description="Natural language user query")
    user_context: Optional[UserContext] = Field(
        default_factory=UserContext, description="Optional spatial or operational context"
    )


class Recommendation(BaseModel):
    status: RecommendationStatus = Field(
        ..., description="Deterministic safety evaluation state"
    )
    summary: str = Field(..., description="Executive 1-2 sentence recommendation summary")
    decisive_factors: List[str] = Field(
        default_factory=list,
        description="List of key numerical or environmental drivers behind the status",
    )
    next_action: str = Field(
        ..., description="Direct actionable directive for the mariner or user"
    )


class Confidence(BaseModel):
    level: ConfidenceLevel = Field(
        ..., description="Derived confidence based on source availability and freshness"
    )
    reasons: List[str] = Field(
        default_factory=list, description="Justification for confidence rating"
    )


class EvidenceItem(BaseModel):
    evidence_id: Optional[str] = Field(
        None, description="Unique deterministic identifier (e.g., 'EV123' or 'EV-INCOIS-WAVE-001')"
    )
    source_name: str = Field(
        ..., description="Official issuing authority (e.g., 'INCOIS Ocean State Forecast')"
    )
    source_url: Optional[str] = Field(
        None, description="Direct URL to official bulletin or portal"
    )
    observed_time: Optional[str] = Field(
        None, description="Timestamp of underlying satellite or sensor measurement"
    )
    valid_from: Optional[str] = Field(
        None, description="Start of forecast/advisory validity window (ISO-8601 UTC)"
    )
    valid_to: Optional[str] = Field(
        None, description="End of forecast/advisory validity window (ISO-8601 UTC)"
    )
    retrieved_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="System retrieval timestamp (ISO-8601 UTC)",
    )
    geometry: Optional[Dict[str, Any]] = Field(
        None, description="Optional GeoJSON Point or Polygon associated with measurement"
    )
    metric_name: Optional[str] = Field(
        None, description="Physical variable name (e.g., 'significant_wave_height')"
    )
    metric_value: Optional[Any] = Field(
        None, description="Numerical value or status"
    )
    metric_unit: Optional[str] = Field(
        None, description="Standard unit (e.g., 'meters', 'knots', 'celsius')"
    )
    quality_flags: List[str] = Field(
        default_factory=list,
        description="Quality badges: 'official_source', 'fresh', 'snapshot_fallback'",
    )


class MapLayer(BaseModel):
    layer_id: str = Field(..., description="Unique identifier for MapLibre layer management")
    name: str = Field(..., description="User-friendly display label in layer selector")
    layer_type: str = Field("geojson", description="Layer format: geojson")
    visible: bool = Field(True, description="Default layer visibility state")
    style: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Rendering aesthetics (color, opacity, stroke)"
    )
    geojson: Dict[str, Any] = Field(
        ..., description="Standard GeoJSON Feature or FeatureCollection"
    )


class AgentTraceItem(BaseModel):
    step: int = Field(..., description="Sequential order in pipeline execution")
    node: str = Field(..., description="LangGraph specialist node name")
    agent: Optional[str] = Field(None, description="Responsible cognitive component, agent, or node identifier")
    action: str = Field(..., description="Sanitized description of task executed")
    status: str = Field("completed", description="Status: started | completed | failed | skipped | blocked | sanitized | degraded")
    duration_ms: Optional[float] = Field(None, description="Execution duration in milliseconds")
    evidence_ids: List[str] = Field(default_factory=list, description="Associated evidence IDs produced or consumed")
    error: Optional[str] = Field(None, description="Sanitized error description when execution fails")
    tool_name: Optional[str] = Field(None, description="Specific tool identifier if step is a specialist tool")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO-8601 UTC timestamp",
    )


class ChatResponse(BaseModel):
    run_id: str = Field(..., description="Unique execution run UUID for telemetry")
    conversation_id: str = Field(..., description="Session conversation UUID")
    language: str = Field("en", description="Detected/responded ISO language code")
    intent: str = Field(..., description="Classified query intent category")
    answer: str = Field(
        ..., description="Synthesized, localized natural language conversational response"
    )
    recommendation: Recommendation = Field(
        ..., description="Deterministic safety recommendation"
    )
    confidence: Confidence = Field(..., description="Evidence-backed confidence rating")
    evidence: List[EvidenceItem] = Field(
        default_factory=list, description="Verifiable citations for all factual assertions"
    )
    map_layers: List[MapLayer] = Field(
        default_factory=list, description="Vector spatial layers to render on MapLibre map"
    )
    trace: List[AgentTraceItem] = Field(
        default_factory=list,
        description="Sanitized high-level execution trace (no private chain-of-thought)",
    )
    warnings: List[str] = Field(
        default_factory=list, description="Operational caveats or degraded fallback notices"
    )
    suggested_followups: List[str] = Field(
        default_factory=list, description="Contextual quick-reply suggestions for the user"
    )
