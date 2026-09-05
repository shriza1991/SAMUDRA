"""LangGraph Node Implementations & Executable Graph for SAMUDRA / ORCA (Milestone M1).

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

Implements the first executable end-to-end vertical slice:
USER INPUT
    ↓
INTENT / LOCALE (Deterministic / Keyword Classifier)
    ↓
SUPERVISOR / PLANNER (TaskPlan Construction)
    ↓
SPECIALIST TOOLS (In-Memory Whitelisted Stub Dispatch via AgentToolRegistry)
    ↓
EVIDENCE VALIDATION (Citation Coverage Gate)
    ↓
RESPONSE COMPOSER (Template-Based Grounded Synthesis)
    ↓
TERMINAL (Final Validation & Trace Sealing)
    ↓
FINAL RESPONSE

All data is strictly tagged as M1_DEMO_DATA / SIMULATED.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from backend.app.agents.evidence import EvidenceValidator
from backend.app.agents.intent import IntentCategory
from backend.app.agents.response import ResponseComposer, ResponseCompositionInput
from backend.app.agents.state import ORCAState
from backend.app.agents.stub_tools import register_m1_stub_tools
from backend.app.agents.tools import tool_registry
from backend.app.contracts.chat import (
    AgentTraceItem,
    Confidence,
    ConfidenceLevel,
    EvidenceItem,
    Recommendation,
    RecommendationStatus,
)


# Auto-register stub tools upon graph module import
register_m1_stub_tools()


# =============================================================================
# Graph Node Identifiers & Metadata Specifications
# =============================================================================

class NodeId(str, Enum):
    """Canonical identifiers for all nodes in the SAMUDRA LangGraph pipeline."""

    INTENT_LOCALE = "intent_locale"
    CLARIFICATION = "clarification"
    SUPERVISOR_PLANNER = "supervisor_planner"
    SPECIALIST_TOOLS = "specialist_tools"
    RISK_EVALUATION = "risk_evaluation"
    EVIDENCE_VALIDATOR = "evidence_validator"
    RESPONSE_COMPOSER = "response_composer"
    TERMINAL = "terminal"


class NodeContract(BaseModel):
    """Architectural specification of a LangGraph node's inputs, responsibilities,
    outputs, and state modification boundaries.
    """

    node_id: NodeId = Field(..., description="Canonical node identifier")
    name: str = Field(..., description="Human-readable node label")
    description: str = Field(..., description="High-level cognitive or routing role")
    inputs: List[str] = Field(..., description="State fields read as inputs")
    allowed_mutations: List[str] = Field(..., description="State fields this node may modify")
    forbidden_actions: List[str] = Field(
        ..., description="Actions strictly forbidden in this node"
    )


GRAPH_NODE_REGISTRY: Dict[NodeId, NodeContract] = {
    NodeId.INTENT_LOCALE: NodeContract(
        node_id=NodeId.INTENT_LOCALE,
        name="Intent / Locale Detection Node",
        description="Extracts language and intent using controlled deterministic rules.",
        inputs=["user_message", "user_profile", "thread_id"],
        allowed_mutations=["language", "intent", "location", "time_window", "trace"],
        forbidden_actions=["Do NOT calculate wave heights or risk status."],
    ),
    NodeId.SUPERVISOR_PLANNER: NodeContract(
        node_id=NodeId.SUPERVISOR_PLANNER,
        name="Supervisor / Task Planner Node",
        description="Constructs bounded specialist tool plan based on classified intent.",
        inputs=["intent", "location", "time_window", "user_profile"],
        allowed_mutations=["task_plan", "trace"],
        forbidden_actions=["Do NOT execute tools directly within the planner."],
    ),
    NodeId.SPECIALIST_TOOLS: NodeContract(
        node_id=NodeId.SPECIALIST_TOOLS,
        name="Specialist Tool Execution Node",
        description="Dispatches tools via AgentToolRegistry and standardizes into ToolResult.",
        inputs=["task_plan", "location", "time_window", "user_profile"],
        allowed_mutations=["tool_results", "observations", "evidence", "warnings", "risk_assessment", "confidence", "trace"],
        forbidden_actions=["Do NOT execute unapproved functions outside registry."],
    ),
    NodeId.EVIDENCE_VALIDATOR: NodeContract(
        node_id=NodeId.EVIDENCE_VALIDATOR,
        name="Evidence Validator Node",
        description="Audits factual citations and ensures claims are backed by evidence.",
        inputs=["evidence", "observations"],
        allowed_mutations=["evidence", "warnings", "trace"],
        forbidden_actions=["Do NOT allow ungrounded numerical claims to pass without warning."],
    ),
    NodeId.RESPONSE_COMPOSER: NodeContract(
        node_id=NodeId.RESPONSE_COMPOSER,
        name="Response Composer Node",
        description="Synthesizes localized, evidence-backed conversational answer.",
        inputs=["language", "intent", "risk_assessment", "observations", "evidence"],
        allowed_mutations=["response", "map_layers", "suggested_followups", "trace"],
        forbidden_actions=["Do NOT alter deterministic recommendation status (GO/CAUTION/NO_GO)."],
    ),
    NodeId.TERMINAL: NodeContract(
        node_id=NodeId.TERMINAL,
        name="Terminal / Finalization Node",
        description="Finalizes and seals state for client delivery.",
        inputs=["response", "risk_assessment", "evidence", "trace"],
        allowed_mutations=["trace"],
        forbidden_actions=["Do NOT return without valid response or trace."],
    ),
}


class RoutingPolicy(BaseModel):
    """Enforces safety limits and invariants on LangGraph edge traversal."""

    max_execution_steps: int = Field(15, description="Upper bound on total node executions")
    max_clarification_turns: int = Field(2, description="Maximum clarification turns")
    allow_parallel_specialist_execution: bool = Field(True, description="Enable concurrent dispatch")
    enforce_evidence_gate: bool = Field(True, description="Enforce evidence validation")


# =============================================================================
# Helper: Trace Item Append
# =============================================================================

def _append_trace(
    current_trace: Optional[List[AgentTraceItem]],
    node_name: str,
    action: str,
    status: str = "completed",
) -> List[AgentTraceItem]:
    """Appends a new sanitized trace item to the execution history."""
    trace_list = list(current_trace or [])
    step_num = len(trace_list) + 1
    trace_list.append(
        AgentTraceItem(
            step=step_num,
            node=node_name,
            action=action,
            status=status,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    )
    return trace_list


# =============================================================================
# Node 1: Intent & Locale Classification (Deterministic M1 Implementation)
# =============================================================================

def intent_locale_node(state: ORCAState) -> Dict[str, Any]:
    """Classifies user intent and locale using transparent keyword rules for M1."""
    raw_msg = state.get("user_message", "").strip()
    msg_lower = raw_msg.lower()

    # 1. Language Detection (English baseline, with Marathi and Hindi keyword detection)
    lang = state.get("language") or "en"
    marathi_keywords = ["उद्या", "सुरक्षित", "लाटा", "मासेमारी", "बंदर", "होडी", "सावध", "आहे का"]
    hindi_keywords = ["क्या", "तूफान", "हवा", "नाव", "मछली", "सकते", "चेतावनी", "सुरक्षा"]

    if any(kw in raw_msg for kw in marathi_keywords):
        lang = "mr"
    elif any(kw in raw_msg for kw in hindi_keywords):
        lang = "hi"

    # 2. Intent Classification
    if any(k in msg_lower for k in ["pfz", "fishing zone", "fish ground", "मत्स्य"]) or (
        "fish" in msg_lower and any(q in msg_lower for q in ["where", "nearest", "find", "कुठे", "कहाँ"])
    ):
        intent = IntentCategory.PFZ
    elif any(k in msg_lower for k in ["route", "passage", "channel", "waypoint", "रास्ता", "मार्ग"]):
        intent = IntentCategory.ROUTE
    elif any(k in msg_lower for k in ["why", "explain", "risky", "reason", "कारण", "का", "क्यों"]):
        intent = IntentCategory.ANALYTICAL_EXPLANATION
    elif any(k in msg_lower for k in ["cyclone", "storm", "hazard", "warning", "lightning", "तूफान", "चेतावनी", "firing", "restricted", "range"]):
        intent = IntentCategory.HAZARDS
    elif any(k in msg_lower for k in ["safe", "safety", "सुरक्षित", "सुरक्षा", "leave", "depart", "sail", "can we go", "can i go", "fishing tomorrow"]):
        intent = IntentCategory.SAFETY
    elif any(k in msg_lower for k in ["wave", "swell", "current", "condition", "sea state", "समुद्र", "लाटा"]):
        intent = IntentCategory.CONDITIONS
    else:
        intent = IntentCategory.UNSUPPORTED

    # 3. Location Extraction
    harbors = ["ratnagiri", "veraval", "porbandar", "mumbai", "panaji", "goa", "malpe", "chennai"]
    detected_harbor = "Ratnagiri"  # Default fallback for M1 demo
    for h in harbors:
        if h in msg_lower:
            detected_harbor = h.capitalize()
            break

    location = state.get("location") or {"harbor": detected_harbor, "coordinates": [73.28, 16.99]}
    time_window = state.get("time_window") or {"departure_time": "tomorrow_morning", "duration_hours": 8.0}

    trace = _append_trace(
        state.get("trace"),
        node_name="Intent / Locale",
        action=f"Detected intent '{intent.value}' and locale '{lang}' (Harbor: {detected_harbor})",
    )

    return {
        "intent": intent.value,
        "language": lang,
        "location": location,
        "time_window": time_window,
        "missing_fields": [],
        "clarification_needed": False,
        "trace": trace,
    }


# =============================================================================
# Node 2: Supervisor / Task Planner Node
# =============================================================================

def supervisor_node(state: ORCAState) -> Dict[str, Any]:
    """Generates a bounded TaskPlan mapping the classified intent to specialist stub tools."""
    intent_val = state.get("intent", IntentCategory.UNSUPPORTED.value)

    if intent_val == IntentCategory.PFZ.value:
        tools = ["pfz_stub"]
    elif intent_val == IntentCategory.SAFETY.value:
        tools = ["marine_stub", "weather_stub", "risk_stub"]
    elif intent_val == IntentCategory.CONDITIONS.value:
        tools = ["marine_stub"]
    elif intent_val == IntentCategory.HAZARDS.value:
        tools = ["weather_stub"]
    elif intent_val == IntentCategory.ROUTE.value:
        tools = ["route_stub"]
    elif intent_val == IntentCategory.ANALYTICAL_EXPLANATION.value:
        tools = ["explanation_stub"]
    else:
        # UNSUPPORTED queries schedule ZERO tools
        tools = []

    trace = _append_trace(
        state.get("trace"),
        node_name="Supervisor / Planner",
        action=f"Constructed TaskPlan with {len(tools)} tool(s): {tools}",
    )

    return {
        "task_plan": tools,
        "trace": trace,
    }


# =============================================================================
# Node 3: Specialist Tool Execution Node
# =============================================================================

def specialist_tools_node(state: ORCAState) -> Dict[str, Any]:
    """Dispatches scheduled tools via AgentToolRegistry and collects normalized ToolResults."""
    task_plan = state.get("task_plan", [])
    harbor = state.get("location", {}).get("harbor", "Ratnagiri")
    craft_type = state.get("user_profile", {}).get("craft_profile", "motorized_boat")

    tool_results: Dict[str, Any] = dict(state.get("tool_results", {}))
    observations: Dict[str, Any] = dict(state.get("observations", {}))
    collected_evidence: List[EvidenceItem] = list(state.get("evidence", []))
    collected_warnings: List[str] = list(state.get("warnings", []))
    risk_assessment: Optional[Recommendation] = state.get("risk_assessment")
    derived_confidence: Optional[Confidence] = state.get("confidence")
    trace = list(state.get("trace", []))

    for tool_name in task_plan:
        # Prepare tool arguments
        params: Dict[str, Any] = {}
        if tool_name in ["pfz_stub", "marine_stub", "weather_stub"]:
            params["harbor"] = harbor
        elif tool_name == "risk_stub":
            # Pass collected marine observations into risk engine
            wave_m = observations.get("significant_wave_height_m", 1.8)
            wind_kts = observations.get("wind_speed_knots", 16.0)
            cyclone = observations.get("cyclone_warning_active", False)
            params = {
                "wave_height_m": wave_m,
                "wind_speed_knots": wind_kts,
                "cyclone_active": cyclone,
                "craft_type": craft_type,
            }
        elif tool_name == "route_stub":
            params["origin_harbor"] = harbor

        # Execute through typed registry
        result = tool_registry.execute_tool(tool_name, params)
        tool_results[tool_name] = result.data

        # Merge tool data into state
        if result.data:
            observations.update(result.data)

        # Collect evidence & warnings
        collected_evidence.extend(result.evidence)
        collected_warnings.extend(result.warnings)

        # If risk_stub ran, populate deterministic Recommendation
        if tool_name == "risk_stub" and "recommendation" in result.data:
            rec_dict = result.data["recommendation"]
            risk_assessment = Recommendation(**rec_dict)
            if "confidence" in result.data:
                derived_confidence = Confidence(**result.data["confidence"])

        trace = _append_trace(
            trace,
            node_name=f"Specialist Tool: {tool_name}",
            action=f"Executed '{tool_name}' (status: {result.status.value}, evidence items: {len(result.evidence)})",
        )

    return {
        "tool_results": tool_results,
        "observations": observations,
        "evidence": collected_evidence,
        "warnings": collected_warnings,
        "risk_assessment": risk_assessment,
        "confidence": derived_confidence,
        "trace": trace,
    }


# =============================================================================
# Node 4: Evidence Validator Node
# =============================================================================

def evidence_validator_node(state: ORCAState) -> Dict[str, Any]:
    """Audits whether factual and numerical claims are backed by verifiable evidence citations."""
    evidence = state.get("evidence", [])
    intent = state.get("intent")

    critical_metrics: List[str] = []
    if intent == IntentCategory.SAFETY.value:
        critical_metrics = ["significant_wave_height", "risk_status"]
    elif intent == IntentCategory.PFZ.value:
        critical_metrics = ["pfz_distance_nm"]
    elif intent == IntentCategory.CONDITIONS.value:
        critical_metrics = ["significant_wave_height"]

    report = EvidenceValidator.audit_evidence(evidence, critical_metrics)
    warnings = list(state.get("warnings", []))

    if not report.is_valid:
        warnings.extend([f"Missing evidence for metric: {m}" for m in report.unverified_claims])

    trace = _append_trace(
        state.get("trace"),
        node_name="Evidence Validator",
        action=f"Audited {len(evidence)} citation(s) against critical metrics (Quality: {report.quality_summary})",
    )

    return {
        "warnings": warnings,
        "trace": trace,
    }


# =============================================================================
# Node 5: Response Composer Node
# =============================================================================

def response_composer_node(state: ORCAState) -> Dict[str, Any]:
    """Synthesizes the final natural-language answer, strictly preserving deterministic safety status."""
    intent_val = state.get("intent", IntentCategory.UNSUPPORTED.value)
    harbor = state.get("location", {}).get("harbor", "Ratnagiri")
    evidence = state.get("evidence", [])
    evidence_names = ", ".join(set(ev.source_name for ev in evidence)) or "No external evidence required"

    if intent_val == IntentCategory.UNSUPPORTED.value:
        answer = (
            "SAMUDRA is focused exclusively on marine intelligence, Potential Fishing Zones (PFZ), "
            "coastal weather forecasts, and maritime safety advisories. Your query does not appear to be "
            "related to marine operations. Please ask about sea conditions, fishing zones, safe routes, "
            "or departure advisories."
        )
        recommendation = Recommendation(
            status=RecommendationStatus.INFORMATIONAL,
            summary="Query outside marine intelligence purview.",
            decisive_factors=["Unsupported domain query"],
            next_action="Submit a marine-focused inquiry.",
        )
        confidence = Confidence(
            level=ConfidenceLevel.HIGH,
            reasons=["Intent classified as out-of-scope"],
        )

    elif intent_val == IntentCategory.PFZ.value:
        answer = (
            f"[M1 DEMO DATA] A simulated Potential Fishing Zone was identified approximately 12.4 nautical miles "
            f"bearing 285° from {harbor} (water depth: 45m, chlorophyll: 1.25 mg/m³).\n\n"
            f"Supporting Evidence:\n- {evidence_names}\n\n"
            f"Notice: This is demonstration data for software verification and is NOT a live fishing advisory."
        )
        recommendation = Recommendation(
            status=RecommendationStatus.GO,
            summary=f"Simulated PFZ located 12.4 nm bearing 285° from {harbor}.",
            decisive_factors=["Simulated PFZ coordinates available", "Passage conditions verified"],
            next_action="Verify local harbor weather prior to departure (Simulation only).",
        )
        confidence = Confidence(
            level=ConfidenceLevel.MEDIUM,
            reasons=["Generated from M1 demonstration dataset"],
        )

    elif intent_val == IntentCategory.SAFETY.value:
        rec = state.get("risk_assessment")
        if not rec:
            rec = Recommendation(
                status=RecommendationStatus.UNKNOWN,
                summary="Insufficient data to compute deterministic safety state.",
                decisive_factors=[],
                next_action="Request updated observations.",
            )

        recommendation = rec
        factors_text = "\n".join(f"- {factor}" for factor in rec.decisive_factors)
        answer = (
            f"[{rec.status.value}]\n\n"
            f"{rec.summary}\n\n"
            f"Key Decisive Factors:\n{factors_text}\n\n"
            f"Actionable Directive: {rec.next_action}\n\n"
            f"Supporting Evidence:\n- {evidence_names}\n\n"
            f"Notice: This is an M1 demonstration response generated from simulated marine, weather, and risk inputs. "
            f"Live safety decisions are not available in M1."
        )
        confidence = state.get("confidence") or Confidence(
            level=ConfidenceLevel.MEDIUM,
            reasons=["Evaluated against M1 simulated sea-state thresholds"],
        )

    elif intent_val == IntentCategory.CONDITIONS.value:
        obs = state.get("observations", {})
        wave = obs.get("significant_wave_height_m", 1.8)
        swell_period = obs.get("swell_period_sec", 8.5)
        answer = (
            f"[M1 DEMO DATA] Simulated marine conditions for {harbor}:\n"
            f"- Significant Wave Height: {wave} meters\n"
            f"- Swell Period: {swell_period} seconds\n"
            f"- Sea Surface Current: 1.1 knots\n\n"
            f"Supporting Evidence:\n- {evidence_names}\n\n"
            f"Notice: Demonstration data only — not an official INCOIS broadcast."
        )
        recommendation = Recommendation(
            status=RecommendationStatus.INFORMATIONAL,
            summary=f"Simulated wave height around {harbor} is {wave}m.",
            decisive_factors=[f"Wave height: {wave}m", f"Swell period: {swell_period}s"],
            next_action="Check live weather reports before sailing.",
        )
        confidence = Confidence(
            level=ConfidenceLevel.MEDIUM,
            reasons=["Simulated M1 ocean state forecast"],
        )

    elif intent_val == IntentCategory.HAZARDS.value:
        answer = (
            f"[M1 DEMO DATA] Weather & Hazard bulletin for {harbor}:\n"
            f"- Cyclone Warning: No active storm warnings in simulated bulletin\n"
            f"- Squall Alert: None\n"
            f"- Wind: 16 knots (gusts to 22 knots)\n\n"
            f"Supporting Evidence:\n- {evidence_names}\n\n"
            f"Notice: Simulated demonstration data only."
        )
        recommendation = Recommendation(
            status=RecommendationStatus.INFORMATIONAL,
            summary="No active storm hazards in simulated dataset.",
            decisive_factors=["Cyclone warning inactive", "Wind gusts under 25 knots"],
            next_action="Monitor VHF marine forecasts regularly.",
        )
        confidence = Confidence(
            level=ConfidenceLevel.MEDIUM,
            reasons=["Simulated M1 coastal weather bulletin"],
        )

    elif intent_val == IntentCategory.ROUTE.value:
        answer = (
            f"[M1 DEMO DATA] Evaluated route passages from {harbor}:\n"
            f"- Route A (Inshore Channel): 28.2 km, wave height 1.4m (Rating: LOW RISK)\n"
            f"- Route B (Deepwater Channel): 22.1 km, wave height 2.2m (Rating: MODERATE RISK)\n\n"
            f"Recommendation: Inshore passage is safer under elevated swell conditions.\n\n"
            f"Supporting Evidence:\n- {evidence_names}\n\n"
            f"Notice: Simulated route calculations for testing."
        )
        recommendation = Recommendation(
            status=RecommendationStatus.CAUTION,
            summary="Inshore passage recommended due to lower wave exposure.",
            decisive_factors=["Route B exceeds 2.0m wave threshold"],
            next_action="Follow Route A waypoint plan (Simulation only).",
        )
        confidence = Confidence(
            level=ConfidenceLevel.MEDIUM,
            reasons=["Simulated route scoring dataset"],
        )

    elif intent_val == IntentCategory.ANALYTICAL_EXPLANATION.value:
        answer = (
            f"[M1 DEMO DATA] Risk Analysis Explanation:\n"
            f"The passage was flagged with restricted caution because the path traverses a shallow coral reef "
            f"buffer zone (RESTRICTED-REEF-ZONE-4).\n\n"
            f"Supporting Evidence:\n- {evidence_names}\n\n"
            f"Notice: Simulated demonstration explanation."
        )
        recommendation = Recommendation(
            status=RecommendationStatus.CAUTION,
            summary="Hazard caution due to environmental buffer proximity.",
            decisive_factors=["Reef buffer zone intersection"],
            next_action="Reroute clear of restricted reef boundary.",
        )
        confidence = Confidence(
            level=ConfidenceLevel.MEDIUM,
            reasons=["Simulated geofence buffer check"],
        )

    else:
        answer = f"[M1 DEMO DATA] Processed query for intent '{intent_val}'."
        recommendation = Recommendation(
            status=RecommendationStatus.INFORMATIONAL,
            summary="Processed demo query.",
            decisive_factors=[],
            next_action="Review advisory.",
        )
        confidence = Confidence(
            level=ConfidenceLevel.MEDIUM,
            reasons=["Simulated M1 dataset"],
        )

    # Validate safety invariance if risk_assessment exists
    if state.get("risk_assessment"):
        comp_input = ResponseCompositionInput(
            run_id=state.get("request_id", "demo-run"),
            conversation_id=state.get("thread_id", "demo-conv"),
            language=state.get("language", "en"),
            intent=intent_val,
            recommendation=recommendation,
            confidence=confidence,
            evidence=evidence,
        )
        composed_chat_response = ResponseComposer.build_chat_response(
            composition_input=comp_input,
            synthesized_answer=answer,
        )
        ResponseComposer.validate_safety_invariance(composed_chat_response, state["risk_assessment"])

    trace = _append_trace(
        state.get("trace"),
        node_name="Response Composer",
        action=f"Synthesized localized response with evidence backing (Status: {recommendation.status.value})",
    )

    return {
        "response": answer,
        "risk_assessment": recommendation,
        "confidence": confidence,
        "trace": trace,
    }


# =============================================================================
# Node 6: Terminal / Finalization Node
# =============================================================================

def terminal_node(state: ORCAState) -> Dict[str, Any]:
    """Finalizes pipeline execution, validates invariants, and seals audit trace."""
    assert state.get("response") is not None, "Pipeline failed: missing response"
    assert state.get("trace") is not None, "Pipeline failed: missing execution trace"

    trace = _append_trace(
        state.get("trace"),
        node_name="Terminal",
        action="Pipeline execution successfully validated and finalized",
    )

    return {
        "trace": trace,
    }


# =============================================================================
# LangGraph Workflow Construction & Compilation
# =============================================================================

def build_orca_graph():
    """Builds and compiles the bounded LangGraph StateGraph for SAMUDRA."""
    builder = StateGraph(ORCAState)

    # 1. Register Nodes
    builder.add_node(NodeId.INTENT_LOCALE.value, intent_locale_node)
    builder.add_node(NodeId.SUPERVISOR_PLANNER.value, supervisor_node)
    builder.add_node(NodeId.SPECIALIST_TOOLS.value, specialist_tools_node)
    builder.add_node(NodeId.EVIDENCE_VALIDATOR.value, evidence_validator_node)
    builder.add_node(NodeId.RESPONSE_COMPOSER.value, response_composer_node)
    builder.add_node(NodeId.TERMINAL.value, terminal_node)

    # 2. Sequential Bounded Edges
    builder.add_edge(START, NodeId.INTENT_LOCALE.value)
    builder.add_edge(NodeId.INTENT_LOCALE.value, NodeId.SUPERVISOR_PLANNER.value)
    builder.add_edge(NodeId.SUPERVISOR_PLANNER.value, NodeId.SPECIALIST_TOOLS.value)
    builder.add_edge(NodeId.SPECIALIST_TOOLS.value, NodeId.EVIDENCE_VALIDATOR.value)
    builder.add_edge(NodeId.EVIDENCE_VALIDATOR.value, NodeId.RESPONSE_COMPOSER.value)
    builder.add_edge(NodeId.RESPONSE_COMPOSER.value, NodeId.TERMINAL.value)
    builder.add_edge(NodeId.TERMINAL.value, END)

    return builder.compile()


# Compiled executable graph singleton
orca_graph = build_orca_graph()


def run_orca_graph(
    user_message: str,
    thread_id: str = "default-thread",
    user_context: Optional[Dict[str, Any]] = None,
) -> ORCAState:
    """Convenience execution runner to execute a query through the LangGraph pipeline."""
    initial_state: ORCAState = {
        "request_id": f"req-{uuid.uuid4().hex[:8]}",
        "thread_id": thread_id,
        "user_message": user_message,
        "user_profile": (user_context or {}).copy(),
        "trace": [],
        "evidence": [],
        "warnings": [],
        "map_layers": [],
        "suggested_followups": [],
    }

    final_state = orca_graph.invoke(initial_state)
    return final_state
