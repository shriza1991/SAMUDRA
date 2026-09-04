"""LangGraph Agent Pipeline State Definition.

Owned by Dev 3 (Agent Orchestration).
Specifies the shared mutable state passed between LangGraph nodes.
"""

from typing import Any, Dict, List, Optional, TypedDict
from backend.app.contracts.chat import (
    AgentTraceItem,
    Confidence,
    EvidenceItem,
    MapLayer,
    Recommendation,
)


class AgentState(TypedDict, total=False):
    """Shared state dictionary traversed by LangGraph nodes."""

    # Session & User Inputs
    run_id: str
    conversation_id: str
    user_message: str
    user_context: Dict[str, Any]

    # Cognitive Extraction
    detected_language: str  # ISO code: en, hi, mr, ta
    detected_intent: str  # NEAREST_PFZ, GO_NO_GO_SAFETY, HAZARD_BOUNDARY, SAFER_ROUTE, INFORMATIONAL
    extracted_entities: Dict[str, Any]  # origin, coordinates, craft_type, time_window
    clarification_needed: bool
    clarification_prompt: Optional[str]

    # Planning
    task_plan: List[str]  # List of specialist tools to execute
    tool_results: Dict[str, Any]  # Results returned from Dev 4 deterministic tools

    # Risk & Evaluation (Populated by deterministic tool results, NOT LLM hallucination)
    recommendation: Optional[Recommendation]
    confidence: Optional[Confidence]

    # Provenance & Geospatial Output
    evidence_items: List[EvidenceItem]
    map_layers: List[MapLayer]
    trace_events: List[AgentTraceItem]

    # Output Synthesis
    final_answer: str
    warnings: List[str]
    suggested_followups: List[str]
