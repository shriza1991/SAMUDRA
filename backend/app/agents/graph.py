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
import json
import re
from typing import Any, Dict, List, Optional
import uuid

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from backend.app.agents.evidence import EvidenceValidator
from backend.app.agents.intent import (
    ExtractedEntities,
    IntentCategory,
    IntentExtractionResult,
    LLMResponseDraft,
    LLMTaskPlanProposal,
)
from backend.app.agents.llm import (
    LLMMessage,
    LLMProvider,
    MessageRole,
    get_llm_provider,
)
from backend.app.agents.memory import memory_manager
from backend.app.agents.response import ResponseComposer, ResponseCompositionInput
from backend.app.agents.security import PromptInjectionGuard
from backend.app.agents.state import ORCAState
from backend.app.agents.stub_tools import register_m1_stub_tools
from backend.app.agents.tools import ToolStatus, tool_registry
from backend.app.contracts.chat import (
    AgentTraceItem,
    Confidence,
    ConfidenceLevel,
    EvidenceItem,
    Recommendation,
    RecommendationStatus,
)
from backend.app.prompts import load_prompt


# Reference coordinates for major Indian coastal landing centers / harbors (EPSG:4326 [lon, lat])
HARBOR_COORDINATES: Dict[str, List[float]] = {
    "Ratnagiri": [73.28, 16.99],
    "Veraval": [70.37, 20.90],
    "Porbandar": [69.60, 21.64],
    "Mumbai": [72.87, 18.92],
    "Panaji": [73.83, 15.49],
    "Goa": [73.83, 15.49],
    "Malpe": [74.70, 13.35],
    "Malvan": [73.47, 16.06],
    "Chennai": [80.27, 13.08],
    "Tuticorin": [78.13, 8.76],
    "Kochi": [76.27, 9.93],
    "Mangalore": [74.85, 12.87],
    "Karwar": [74.13, 14.81],
    "Alibaug": [72.88, 18.64],
    "Visakhapatnam": [83.30, 17.68],
    "Kakinada": [82.23, 16.99],
    "Paradip": [86.67, 20.32],
}


def _get_harbor_coordinates(harbor: Optional[str]) -> Optional[List[float]]:
    """Resolves standard [lon, lat] coordinates for known harbors."""
    if not harbor:
        return None
    return HARBOR_COORDINATES.get(harbor, [73.28, 16.99])


def _generate_clarification_prompt(
    intent: IntentCategory,
    language: str = "en",
    missing_fields: Optional[List[str]] = None,
) -> str:
    """Generates a localized clarification question requesting missing operational parameters."""
    lang_lower = (language or "en").lower()
    if intent == IntentCategory.PFZ:
        if lang_lower == "mr":
            return "जवळचे संभाव्य मत्स्य क्षेत्र (PFZ) शोधण्यासाठी, कृपया आपले प्रस्थान बंदर (उदा. रत्नागिरी, मालवण, वेरावळ किंवा मुंबई) सांगा."
        elif lang_lower == "hi":
            return "निकटतम मत्स्य क्षेत्र (PFZ) खोजने के लिए, कृपया अपना प्रस्थान बंदरगाह (जैसे रत्नागिरी, मालवण, वेरावल या मुंबई) बताएं।"
        elif lang_lower == "ta":
            return "அருகிலுள்ள மீன்பிடி மண்டலத்தைக் (PFZ) கண்டறிய, தயவுசெய்து உங்கள் புறப்படும் துறைமுகத்தைக் குறிப்பிடவும் (எ.கா. தூத்துக்குடி, சென்னை, கொச்சி)."
        else:
            return "To locate the nearest Potential Fishing Zone (PFZ), please specify your departure harbor (e.g., Ratnagiri, Malvan, Veraval, or Mumbai)."

    if lang_lower == "mr":
        return "सुरक्षिततेचा अंदाज घेण्यासाठी, कृपया आपले प्रस्थान बंदर सांगा."
    elif lang_lower == "hi":
        return "सुरक्षा मूल्यांकन के लिए, कृपया अपना प्रस्थान बंदरगाह बताएं।"
    elif lang_lower == "ta":
        return "பாதுகாப்பு மதிப்பீட்டிற்கு, தயவுசெய்து உங்கள் புறப்படும் துறைமுகத்தைக் குறிப்பிடவும்."
    return "To provide an accurate maritime assessment, please specify your departure harbor."


# Helper function: canonical capability dependency order
def _enforce_dependency_order(capabilities: List[str]) -> List[str]:
    """Orders specialist capabilities by dependency DAG."""
    order_rank = {
        "marine_conditions": 10,
        "weather_conditions": 20,
        "hazard_search": 30,
        "pfz_source": 40,
        "pfz_search": 50,
        "route_analysis": 60,
        "geofence_check": 70,
        "risk_evaluation": 80,
    }
    return sorted(capabilities, key=lambda c: order_rank.get(c, 100))


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
        allowed_mutations=["language", "intent", "location", "time_window", "missing_fields", "clarification_needed", "clarification_prompt", "trace"],
        forbidden_actions=["Do NOT calculate wave heights or risk status."],
    ),
    NodeId.CLARIFICATION: NodeContract(
        node_id=NodeId.CLARIFICATION,
        name="Clarification Node",
        description="Generates courteous, localized clarification questions when critical operational context is missing.",
        inputs=["user_message", "intent", "language", "missing_fields", "clarification_prompt"],
        allowed_mutations=["response", "risk_assessment", "confidence", "suggested_followups", "trace"],
        forbidden_actions=["Do NOT execute specialist tools or fabricate operational locations."],
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
# Node 1: Intent & Locale Classification (LLM-Assisted with Deterministic Fallback)
# =============================================================================

def intent_locale_node(state: ORCAState) -> Dict[str, Any]:
    """Classifies user intent and locale using LLM assistance with transparent fallback."""
    raw_msg = state.get("user_message", "").strip()
    thread_id = state.get("thread_id", "default-thread")
    trace = list(state.get("trace", []))

    # 1. Prompt Injection & Adversarial Query Defense
    is_injection, injection_reason = PromptInjectionGuard.detect_injection(raw_msg)
    if is_injection:
        trace = _append_trace(
            trace,
            node_name="Security Guard",
            action=f"Prompt injection attempt detected ({injection_reason}). Neutralizing adversarial input.",
            status="blocked",
        )
        return {
            "intent": IntentCategory.UNSUPPORTED.value,
            "language": "en",
            "location": {"harbor": "Ratnagiri", "coordinates": [73.28, 16.99]},
            "time_window": {"departure_time": "tomorrow_morning", "duration_hours": 8.0},
            "missing_fields": [],
            "clarification_needed": False,
            "warnings": list(state.get("warnings", [])) + [f"Security alert: {injection_reason}"],
            "trace": trace,
        }

    # 2. LLM-Assisted Extraction (If provider is configured)
    llm_provider: Optional[LLMProvider] = state.get("llm_provider")
    if llm_provider is not None:
        try:
            sanitized_input = PromptInjectionGuard.sanitize_user_input(raw_msg)
            system_prompt = load_prompt("intent.md")
            messages = [
                LLMMessage(role=MessageRole.SYSTEM, content=system_prompt),
                LLMMessage(role=MessageRole.USER, content=sanitized_input),
            ]
            extraction = llm_provider.generate_structured(
                messages=messages,
                response_schema=IntentExtractionResult,
                temperature=0.0,
                timeout_seconds=5.0,
            )

            # Strict IntentCategory boundary validation
            if isinstance(extraction.intent, IntentCategory):
                validated_intent = extraction.intent.value
            elif extraction.intent in [c.value for c in IntentCategory]:
                validated_intent = extraction.intent
            else:
                raise ValueError(f"Extracted intent '{extraction.intent}' is not an approved IntentCategory.")

            # 2. Memory Context Integration & Selective Carry-Forward (M4)
            thread_ctx = memory_manager.load_context(thread_id)
            user_prof = state.get("user_profile") or {}
            if not thread_ctx.active_harbor and (user_prof.get("active_harbor") or user_prof.get("harbor")):
                thread_ctx.active_harbor = user_prof.get("active_harbor") or user_prof.get("harbor")

            updated_ctx, audit_summary = memory_manager.apply_memory_policy(
                current_context=thread_ctx,
                extracted_entities=extraction.entities,
                current_intent=IntentCategory(validated_intent),
                detected_language=extraction.detected_language,
                raw_user_message=raw_msg,
            )
            memory_manager.save_context(updated_ctx)

            # PFZ Origin Resolution:
            # 1. Explicit origin in current user message
            # 2. Valid active harbor from current ThreadContext
            # 3. Otherwise request clarification (DO NOT fall back to Ratnagiri)
            origin_harbor: Optional[str] = None
            clarification_needed = extraction.clarification_needed
            missing_fields = list(extraction.missing_critical_fields)
            clarification_prompt = extraction.clarification_prompt

            if validated_intent == IntentCategory.PFZ.value:
                explicit_harbor = extraction.entities.origin_harbor
                if explicit_harbor:
                    origin_harbor = explicit_harbor
                    clarification_needed = False
                    missing_fields = [f for f in missing_fields if f not in ["origin_harbor", "harbor"]]
                elif updated_ctx.active_harbor:
                    origin_harbor = updated_ctx.active_harbor
                    clarification_needed = False
                    missing_fields = [f for f in missing_fields if f not in ["origin_harbor", "harbor"]]
                else:
                    origin_harbor = None
                    clarification_needed = True
                    if "origin_harbor" not in missing_fields:
                        missing_fields.append("origin_harbor")
                    if not clarification_prompt:
                        clarification_prompt = _generate_clarification_prompt(
                            IntentCategory.PFZ,
                            language=extraction.detected_language or "en",
                            missing_fields=missing_fields,
                        )
            else:
                detected_harbor = updated_ctx.active_harbor or "Ratnagiri"
                origin_harbor = detected_harbor

            if origin_harbor:
                location = state.get("location") or {
                    "harbor": origin_harbor,
                    "coordinates": updated_ctx.active_coordinates or extraction.entities.coordinates or _get_harbor_coordinates(origin_harbor),
                }
            else:
                location = None

            time_window = state.get("time_window") or updated_ctx.time_window or {
                "departure_time": "tomorrow_morning",
                "duration_hours": 8.0,
            }

            carried_str = ", ".join(audit_summary["carried_fields"]) or "none"
            overwritten_str = ", ".join(audit_summary["overwritten_fields"]) or "none"
            trace = _append_trace(
                trace,
                node_name="Intent / Locale",
                action=f"LLM extraction ({llm_provider.provider_name}/{llm_provider.model_name}): "
                       f"intent='{validated_intent}', locale='{extraction.detected_language}' (Harbor: {origin_harbor or 'Unresolved'}) "
                       f"[Memory Turn {updated_ctx.turn_count}: carried=({carried_str}), overwritten=({overwritten_str})]"
                       + (f" [Clarification needed: {', '.join(missing_fields)}]" if clarification_needed else ""),
            )

            return {
                "intent": validated_intent,
                "origin_harbor": origin_harbor,
                "language": extraction.detected_language or updated_ctx.preferred_language or "en",
                "location": location,
                "time_window": time_window,
                "missing_fields": missing_fields,
                "clarification_needed": clarification_needed,
                "clarification_prompt": clarification_prompt,
                "trace": trace,
            }
        except Exception as exc:
            trace = _append_trace(
                trace,
                node_name="Intent / Locale",
                action=f"LLM extraction fallback triggered ({type(exc).__name__}: {str(exc)}); using deterministic classifier",
                status="degraded",
            )
            # Fall through seamlessly to deterministic classifier below

    # 3. Deterministic Fallback Classifier
    msg_lower = raw_msg.lower()
    lang = state.get("language") or "en"
    marathi_distinctive = ["उद्या", "लाटा", "मासेमारी", "होडी", "सावध", "आहे का", "कुठे", "सकाळी", "वाजता", "जाणे", "आहे", "आहेत", "नाही", "वारा", "सांग", "कशी"]
    hindi_distinctive = ["क्या", "तूफान", "हवा", "नाव", "मछली", "सकते", "चेतावनी", "सुरक्षा", "कहाँ", "कहा", "कल", "सुबह", "पकड़ने", "जाना", "है"]

    mr_count = sum(1 for kw in marathi_distinctive if kw in raw_msg)
    hi_count = sum(1 for kw in hindi_distinctive if kw in raw_msg)
    if mr_count > hi_count:
        lang = "mr"
    elif hi_count > mr_count:
        lang = "hi"
    elif mr_count > 0:
        lang = "mr"

    indic_harbors = {
        "रत्नागिरी": "Ratnagiri",
        "मालवण": "Malvan",
        "वेरावळ": "Veraval",
        "वेरावल": "Veraval",
        "मुंबई": "Mumbai",
        "गोवा": "Goa",
        "चेन्नई": "Chennai",
        "कोची": "Kochi",
    }
    known_harbors = [
        "ratnagiri", "veraval", "porbandar", "mumbai", "panaji", "goa",
        "malpe", "malvan", "chennai", "tuticorin", "kochi", "cochin",
        "mangalore", "karwar", "alibaug", "visakhapatnam", "vizag",
        "kakinada", "paradip", "digha", "puri", "bhavnagar", "okha",
        "mandvi", "jafrabad", "trivandrum", "kanyakumari", "pondicherry",
    ]

    explicit_harbor = None
    for ih_kw, ih_val in indic_harbors.items():
        if ih_kw in raw_msg:
            explicit_harbor = ih_val
            break

    if not explicit_harbor:
        for h in known_harbors:
            if re.search(rf"\b{h}\b", msg_lower):
                explicit_harbor = h.capitalize()
                break

    if not explicit_harbor:
        # Regex extraction for "from <harbor>", "at <harbor>", "off <harbor>"
        match = re.search(r"\b(?:from|at|near|off|around)\s+([A-Za-z]+)\b", raw_msg, re.IGNORECASE)
        if match:
            candidate = match.group(1).capitalize()
            stop_words = {
                "The", "Here", "There", "Port", "Harbor", "Coast", "Sea",
                "Tomorrow", "Today", "Now", "Me", "My", "Us", "Any", "Our", "All", "Route",
            }
            if candidate not in stop_words:
                explicit_harbor = candidate

    if any(k in msg_lower for k in ["pfz", "fishing zone", "fish ground", "मत्स्य"]) or (
        any(f in msg_lower for f in ["fish", "मछली", "मासेमारी"]) and any(q in msg_lower for q in ["where", "nearest", "find", "कुठे", "कहाँ", "कहा", "निकटतम"])
    ):
        intent = IntentCategory.PFZ
    elif any(k in msg_lower for k in ["cyclone", "storm", "hazard", "warning", "squall", "depression", "gale", "lightning", "तूफान", "चेतावनी", "धोका", "firing", "restricted", "range"]):
        intent = IntentCategory.HAZARDS
    elif any(k in msg_lower for k in ["route", "passage", "channel", "waypoint", "रास्ता", "मार्ग"]):
        intent = IntentCategory.ROUTE
    elif any(k in msg_lower for k in ["safe", "safety", "सुरक्षित", "सुरक्षा", "leave", "depart", "sail", "can we go", "can i go", "head out", "heading out", "go out", "go fishing", "fishing tomorrow", "should i"]):
        intent = IntentCategory.SAFETY
    elif any(k in msg_lower for k in ["why", "explain", "risky", "reason", "कारण", "क्यों"]):
        intent = IntentCategory.ANALYTICAL_EXPLANATION
    elif any(k in msg_lower for k in ["wave", "swell", "current", "condition", "sea state", "समुद्र", "लाटा"]):
        intent = IntentCategory.CONDITIONS
    else:
        # Check if user is continuing a previous intent conversation
        thread_ctx_pre = memory_manager.load_context(thread_id)
        if thread_ctx_pre.last_intent in [IntentCategory.PFZ, IntentCategory.SAFETY, IntentCategory.HAZARDS]:
            if explicit_harbor or any(w in msg_lower for w in ["what about", "how about", "tomorrow", "today", "afternoon", "morning", "evening", "instead"]):
                intent = thread_ctx_pre.last_intent
            else:
                intent = IntentCategory.UNSUPPORTED
        else:
            intent = IntentCategory.UNSUPPORTED

    # Resolve departure time from deterministic message
    dep_time = None
    if "tomorrow" in msg_lower:
        dep_time = "tomorrow"
    elif "today" in msg_lower or "now" in msg_lower:
        dep_time = "now"

    entities = ExtractedEntities(
        origin_harbor=explicit_harbor,
        departure_time=dep_time,
    )

    # Apply M4 selective carry-forward policy
    thread_ctx = memory_manager.load_context(thread_id)
    user_prof = state.get("user_profile") or {}
    if not thread_ctx.active_harbor and (user_prof.get("active_harbor") or user_prof.get("harbor")):
        thread_ctx.active_harbor = user_prof.get("active_harbor") or user_prof.get("harbor")

    updated_ctx, audit_summary = memory_manager.apply_memory_policy(
        current_context=thread_ctx,
        extracted_entities=entities,
        current_intent=intent,
        detected_language=lang,
        raw_user_message=raw_msg,
    )
    memory_manager.save_context(updated_ctx)

    # PFZ Origin Resolution:
    # 1. Explicit origin in current user message
    # 2. Valid active harbor from current ThreadContext
    # 3. Otherwise request clarification (DO NOT fall back to Ratnagiri or hard-coded harbor)
    origin_harbor: Optional[str] = None
    clarification_needed: bool = False
    missing_fields: List[str] = []
    clarification_prompt: Optional[str] = None

    if intent == IntentCategory.PFZ:
        if explicit_harbor:
            origin_harbor = explicit_harbor
        elif updated_ctx.active_harbor:
            origin_harbor = updated_ctx.active_harbor
        else:
            clarification_needed = True
            missing_fields = ["origin_harbor"]
            clarification_prompt = _generate_clarification_prompt(
                IntentCategory.PFZ,
                language=lang,
                missing_fields=missing_fields,
            )
    else:
        detected_harbor = updated_ctx.active_harbor or "Ratnagiri"
        origin_harbor = detected_harbor

    if origin_harbor:
        location = state.get("location") or {
            "harbor": origin_harbor,
            "coordinates": updated_ctx.active_coordinates or _get_harbor_coordinates(origin_harbor) or [73.28, 16.99],
        }
    else:
        location = None

    time_window = state.get("time_window") or updated_ctx.time_window or {"departure_time": "tomorrow_morning", "duration_hours": 8.0}

    carried_str = ", ".join(audit_summary["carried_fields"]) or "none"
    overwritten_str = ", ".join(audit_summary["overwritten_fields"]) or "none"
    trace = _append_trace(
        trace,
        node_name="Intent / Locale",
        action=f"Detected intent '{intent.value}' and locale '{lang}' (Harbor: {origin_harbor or 'Unresolved'}) "
               f"[Memory Turn {updated_ctx.turn_count}: carried=({carried_str}), overwritten=({overwritten_str})]"
               + (f" [Clarification needed: {', '.join(missing_fields)}]" if clarification_needed else ""),
    )

    return {
        "intent": intent.value,
        "origin_harbor": origin_harbor,
        "language": lang,
        "location": location,
        "time_window": time_window,
        "missing_fields": missing_fields,
        "clarification_needed": clarification_needed,
        "clarification_prompt": clarification_prompt,
        "trace": trace,
    }


# =============================================================================
# Node 2: Supervisor / Task Planner Node
# =============================================================================

def supervisor_node(state: ORCAState) -> Dict[str, Any]:
    """Generates a bounded TaskPlan mapping the classified intent to specialist tools or contract mocks."""
    intent_val = state.get("intent", IntentCategory.UNSUPPORTED.value)
    tool_mode = state.get("tool_mode", "demo")

    if tool_mode == "contract_mock":
        # 1. Capability requirements by intent
        required_capabilities: List[str] = []
        if intent_val == IntentCategory.SAFETY.value:
            required_capabilities = ["marine_conditions", "weather_conditions", "hazard_search", "risk_evaluation"]
        elif intent_val == IntentCategory.PFZ.value:
            required_capabilities = ["pfz_search"]
        elif intent_val == IntentCategory.CONDITIONS.value:
            required_capabilities = ["marine_conditions"]
        elif intent_val == IntentCategory.HAZARDS.value:
            required_capabilities = ["hazard_search"]
        elif intent_val == IntentCategory.ROUTE.value:
            required_capabilities = ["route_analysis"]

        # 2. Capability availability check
        unavailable = tool_registry.get_unavailable_capabilities(required_capabilities)
        if unavailable:
            missing_cap = unavailable[0]
            trace = _append_trace(
                state.get("trace"),
                node_name="Supervisor / Planner",
                action=f"Capability check failed: '{missing_cap}' is currently unavailable. Aborting tool dispatch.",
                status="failed",
            )
            return {
                "task_plan": [],
                "capability_error": missing_cap,
                "trace": trace,
            }

        # 3. LLM-Assisted Task Planning Proposal (if LLM provider available)
        llm_provider: Optional[LLMProvider] = state.get("llm_provider")
        if llm_provider is not None:
            try:
                supervisor_prompt = load_prompt("supervisor.md")
                messages = [
                    LLMMessage(role=MessageRole.SYSTEM, content=supervisor_prompt),
                    LLMMessage(role=MessageRole.USER, content=f"Construct task plan for intent '{intent_val}' (Available capabilities: {tool_registry.list_capabilities()})."),
                ]
                proposal = llm_provider.generate_structured(
                    messages=messages,
                    response_schema=LLMTaskPlanProposal,
                    temperature=0.0,
                    timeout_seconds=5.0,
                )
                approved_capabilities = tool_registry.list_capabilities()
                valid_proposed = [
                    cap for cap in proposal.requested_capabilities
                    if cap in approved_capabilities and tool_registry.is_capability_available(cap)
                ]
                if valid_proposed:
                    # Enforce strict dependency ordering
                    ordered_tools = _enforce_dependency_order(valid_proposed)
                    trace = _append_trace(
                        state.get("trace"),
                        node_name="Supervisor / Planner",
                        action=f"LLM task plan validated ({llm_provider.provider_name}/{llm_provider.model_name}): "
                               f"{len(ordered_tools)} tool(s) scheduled (Rationale: {proposal.planning_rationale or 'Optimized DAG'})",
                    )
                    return {
                        "task_plan": ordered_tools,
                        "trace": trace,
                    }
            except Exception as exc:
                trace = _append_trace(
                    state.get("trace"),
                    node_name="Supervisor / Planner",
                    action=f"LLM planning fallback triggered ({type(exc).__name__}); using deterministic standard plan",
                    status="degraded",
                )
                # Fall through to deterministic plan

        # 4. Standard Deterministic Dependency-ordered Tool Sequences
        if intent_val == IntentCategory.PFZ.value:
            tools = ["marine_conditions", "pfz_search"]
        elif intent_val == IntentCategory.SAFETY.value:
            tools = ["marine_conditions", "weather_conditions", "hazard_search", "risk_evaluation"]
        elif intent_val == IntentCategory.CONDITIONS.value:
            tools = ["marine_conditions"]
        elif intent_val == IntentCategory.HAZARDS.value:
            tools = ["hazard_search"]
        elif intent_val == IntentCategory.ROUTE.value:
            tools = ["marine_conditions", "hazard_search", "route_analysis"]
        elif intent_val == IntentCategory.ANALYTICAL_EXPLANATION.value:
            tools = ["explanation_stub"]
        else:
            tools = []

    else:
        # Default M1 demonstration mode
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
            tools = []

    trace = _append_trace(
        state.get("trace"),
        node_name="Supervisor / Planner",
        action=f"Constructed TaskPlan ({tool_mode}) with {len(tools)} tool(s): {tools}",
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
    harbor = state.get("origin_harbor") or state.get("location", {}).get("harbor", "Ratnagiri")
    craft_type = state.get("user_profile", {}).get("craft_profile", "motorized_boat")

    tool_results: Dict[str, Any] = dict(state.get("tool_results", {}))
    observations: Dict[str, Any] = dict(state.get("observations", {}))
    collected_evidence: List[EvidenceItem] = list(state.get("evidence", []))
    collected_warnings: List[str] = list(state.get("warnings", []))
    risk_assessment: Optional[Recommendation] = state.get("risk_assessment")
    derived_confidence: Optional[Confidence] = state.get("confidence")
    trace = list(state.get("trace", []))

    failed_tools = set()
    for tool_name in task_plan:
        # Check upstream failure for risk evaluation
        if tool_name in ["risk_stub", "risk_evaluation"]:
            critical_deps = {"marine_conditions", "weather_conditions", "marine_stub", "weather_stub"}
            if any(dep in failed_tools for dep in critical_deps):
                collected_warnings.append(f"Skipping '{tool_name}' due to failed upstream environmental dependencies.")
                risk_assessment = Recommendation(
                    status=RecommendationStatus.UNKNOWN,
                    summary="Unable to assess voyage safety because environmental data providers failed.",
                    decisive_factors=["Missing or failed marine/weather observation"],
                    next_action="Hold departure and verify local port authority advisories.",
                )
                derived_confidence = Confidence(
                    level=ConfidenceLevel.LOW,
                    score=0.1,
                    reasons=["Critical upstream dependencies failed"],
                )
                trace = _append_trace(
                    trace,
                    node_name=f"Specialist Tool: {tool_name}",
                    action=f"Aborted '{tool_name}': Upstream environmental dependencies failed. Yielded UNKNOWN.",
                    status="degraded",
                )
                continue

        # Prepare tool arguments
        params: Dict[str, Any] = {}
        if tool_name in ["pfz_stub", "marine_stub", "weather_stub"]:
            params["harbor"] = harbor
        elif tool_name in ["marine_conditions", "weather_conditions", "hazard_search", "pfz_search"]:
            params["origin_harbor"] = harbor
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
        elif tool_name == "risk_evaluation":
            params = {
                "origin_harbor": harbor,
                "craft_profile": craft_type,
            }
        elif tool_name in ["route_stub", "route_analysis"]:
            params["origin_harbor"] = harbor
            params["destination"] = "Outer Bank"

        # Execute through typed registry
        result = tool_registry.execute_tool(tool_name, params)
        if result.status == ToolStatus.FAILED:
            failed_tools.add(tool_name)
            collected_warnings.extend(result.warnings)
            if tool_name in ["risk_stub", "risk_evaluation"]:
                risk_assessment = Recommendation(
                    status=RecommendationStatus.UNKNOWN,
                    summary="Risk evaluation engine failed or was unavailable.",
                    decisive_factors=["Risk evaluation error"],
                    next_action="Hold departure and verify local port authority advisories.",
                )
                derived_confidence = Confidence(
                    level=ConfidenceLevel.LOW,
                    score=0.1,
                    reasons=["Risk evaluation failure"],
                )
            trace = _append_trace(
                trace,
                node_name=f"Specialist Tool: {tool_name}",
                action=f"Tool '{tool_name}' failed: {result.error_code or 'Execution failure'}",
                status="failed",
            )
            continue

        tool_results[tool_name] = result.data

        # Merge tool data into state
        if result.data:
            observations.update(result.data)

        # Collect evidence & warnings
        collected_evidence.extend(result.evidence)
        collected_warnings.extend(result.warnings)

        # If risk engine ran, populate deterministic Recommendation
        if tool_name in ["risk_stub", "risk_evaluation"] and "recommendation" in result.data:
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
    elif intent == IntentCategory.HAZARDS.value:
        critical_metrics = ["cyclone_warning_active"]

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
    capability_error = state.get("capability_error")
    if capability_error:
        answer = (
            f"I cannot provide a reliable safety assessment because the required capability "
            f"'{capability_error}' is currently unavailable. Please try again later or check system status."
        )
        recommendation = Recommendation(
            status=RecommendationStatus.UNKNOWN,
            summary=f"Required capability '{capability_error}' is currently unavailable.",
            decisive_factors=[f"Unavailable capability: {capability_error}"],
            next_action="Wait for external capability to be restored or retry query.",
        )
        confidence = Confidence(
            level=ConfidenceLevel.LOW,
            reasons=[f"Capability '{capability_error}' unavailable"],
        )
        trace = _append_trace(
            state.get("trace"),
            node_name="Response Composer",
            action=f"Capability check failed for '{capability_error}': returned safe fallback advisory",
            status="completed",
        )
        return {
            "response": answer,
            "risk_assessment": recommendation,
            "confidence": confidence,
            "trace": trace,
        }

    intent_val = state.get("intent", IntentCategory.UNSUPPORTED.value)
    harbor = state.get("origin_harbor") or state.get("location", {}).get("harbor", "Ratnagiri")
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
        lang = state.get("language", "en")
        if lang == "mr":
            answer = (
                f"[{rec.status.value}] {harbor} साठी सागरी सुरक्षा सल्ला:\n\n"
                f"{rec.summary}\n\n"
                f"महत्त्वाचे घटक:\n{factors_text}\n\n"
                f"कृती सल्ला: {rec.next_action}\n\n"
                f"पुरावा आधार:\n- {evidence_names}\n\n"
                f"सूचना: हे मूल्यमापन सागरी व हवामान माहितीवर आधारित सल्लागार विश्लेषण आहे."
            )
        elif lang == "hi":
            answer = (
                f"[{rec.status.value}] {harbor} के लिए समुद्री सुरक्षा सलाह:\n\n"
                f"{rec.summary}\n\n"
                f"प्रमुख निर्णायक कारक:\n{factors_text}\n\n"
                f"कार्रवाई योग्य निर्देश: {rec.next_action}\n\n"
                f"साक्ष्य आधार:\n- {evidence_names}\n\n"
                f"सूचना: यह मूल्यांकन समुद्री और मौसम संबंधी इनपुट पर आधारित सलाह है।"
            )
        else:
            answer = (
                f"[{rec.status.value}] Operational Safety Advisory for {harbor}:\n\n"
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
        tool_mode = state.get("tool_mode", "demo")
        obs = state.get("observations", {})
        cyclone = obs.get("cyclone_warning_active", False)
        squall = obs.get("squall_alert", False)
        severity = obs.get("severity", "NORMAL")
        headline = obs.get("headline", "Coastal Weather Watch")

        if tool_mode == "contract_mock":
            if cyclone:
                hazard_status = RecommendationStatus.NO_GO
                summary = f"Active Cyclone Warning for {harbor}: {headline}."
                action = "Do NOT venture out to sea. Return to port or remain securely moored."
            elif squall:
                hazard_status = RecommendationStatus.CAUTION
                summary = f"Squall Alert active for {harbor}: {headline}."
                action = "Exercise caution and stay within sheltered coastal waters."
            else:
                hazard_status = RecommendationStatus.INFORMATIONAL
                summary = f"No active cyclone or severe hazard alerts for {harbor}."
                action = "Standard coastal operations permitted. Monitor VHF broadcasts."

            answer = (
                f"[{hazard_status.value}] IMD Hazard Bulletin for {harbor}:\n"
                f"- Cyclone Warning: {'ACTIVE (Severe Threat)' if cyclone else 'No active cyclone warning'}\n"
                f"- Squall Alert: {'ACTIVE' if squall else 'None'}\n"
                f"- Advisory Severity: {severity}\n"
                f"- Headline: {headline}\n\n"
                f"Actionable Directive: {action}\n\n"
                f"Supporting Evidence:\n- {evidence_names}\n\n"
                f"Notice: IMD hazard advisory bulletin data."
            )
            recommendation = Recommendation(
                status=hazard_status,
                summary=summary,
                decisive_factors=[
                    f"Cyclone warning: {'ACTIVE' if cyclone else 'INACTIVE'}",
                    f"Squall alert: {'ACTIVE' if squall else 'INACTIVE'}",
                    f"Bulletin severity: {severity}",
                ],
                next_action=action,
            )
            confidence = Confidence(
                level=ConfidenceLevel.HIGH,
                reasons=["Authoritative IMD hazard bulletin observation"],
            )
        else:
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

    # 4. LLM Response Synthesis (If LLM provider is available)
    llm_provider: Optional[LLMProvider] = state.get("llm_provider")
    if llm_provider is not None:
        try:
            response_prompt = load_prompt("response.md")
            req_status = recommendation.status.value
            lang = state.get("language", "en")
            system_instruction = (
                f"{response_prompt}\n\n"
                f"CRITICAL IMMUTABLE DIRECTIVE:\n"
                f"The authoritative safety status is [{req_status}]. You MUST NOT change or soften this status.\n"
                f"Output strictly adhering to LLMResponseDraft schema."
            )
            context_summary = {
                "intent": intent_val,
                "language": lang,
                "harbor": harbor,
                "recommendation_status": req_status,
                "recommendation_summary": recommendation.summary,
                "decisive_factors": recommendation.decisive_factors,
                "next_action": recommendation.next_action,
                "observations": state.get("observations", {}),
                "evidence_sources": [ev.source_name for ev in evidence],
            }
            messages = [
                LLMMessage(role=MessageRole.SYSTEM, content=system_instruction),
                LLMMessage(
                    role=MessageRole.USER,
                    content=f"<context_data>\n{json.dumps(context_summary, ensure_ascii=False)}\n</context_data>",
                ),
            ]
            draft = llm_provider.generate_structured(
                messages=messages,
                response_schema=LLMResponseDraft,
                temperature=0.1,
                timeout_seconds=5.0,
            )

            # Audit response draft for safety tampering
            is_valid_safety, violation_reason = PromptInjectionGuard.audit_response_for_tampering(
                draft.synthesized_text,
                recommendation.status,
            )
            if not is_valid_safety:
                trace = _append_trace(
                    state.get("trace"),
                    node_name="Response Composer",
                    action=f"Safety tampering detected in LLM draft ({violation_reason}); falling back to deterministic template",
                    status="blocked",
                )
            else:
                answer = draft.synthesized_text
                trace = _append_trace(
                    state.get("trace"),
                    node_name="Response Composer",
                    action=f"LLM-synthesized localized response ({llm_provider.provider_name}/{llm_provider.model_name}) in '{lang}'",
                )
        except Exception as exc:
            trace = _append_trace(
                state.get("trace"),
                node_name="Response Composer",
                action=f"LLM synthesis fallback triggered ({type(exc).__name__}); using deterministic template",
                status="degraded",
            )
            # Fall back to deterministic template

    # Validate safety invariance if risk_assessment exists or for SAFETY intent
    if state.get("risk_assessment") or intent_val == IntentCategory.SAFETY.value:
        authoritative_rec = state.get("risk_assessment") or recommendation
        comp_input = ResponseCompositionInput(
            run_id=state.get("request_id", "demo-run"),
            conversation_id=state.get("thread_id", "demo-conv"),
            language=state.get("language", "en"),
            intent=intent_val,
            recommendation=authoritative_rec,
            confidence=confidence,
            evidence=evidence,
        )
        composed_chat_response = ResponseComposer.build_chat_response(
            composition_input=comp_input,
            synthesized_answer=answer,
        )
        ResponseComposer.validate_safety_invariance(composed_chat_response, authoritative_rec)

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
# Node: Clarification Node
# =============================================================================

def clarification_node(state: ORCAState) -> Dict[str, Any]:
    """Generates courteous, localized clarification questions when critical operational context is missing.

    Strictly satisfies NodeContract(NodeId.CLARIFICATION):
    - Inputs: user_message, intent, language, missing_fields, clarification_prompt
    - Allowed mutations: response, risk_assessment, confidence, suggested_followups, trace
    - Forbidden: Do NOT execute specialist tools or fabricate operational locations.
    """
    intent_val = state.get("intent", IntentCategory.UNSUPPORTED.value)
    lang = state.get("language", "en")
    missing = state.get("missing_fields", ["origin_harbor"])
    prompt = state.get("clarification_prompt")
    trace = list(state.get("trace", []))

    if not prompt:
        try:
            intent_enum = IntentCategory(intent_val)
        except ValueError:
            intent_enum = IntentCategory.UNSUPPORTED
        prompt = _generate_clarification_prompt(intent_enum, language=lang, missing_fields=missing)

    # Suggest regional harbor quick chips
    if lang == "mr":
        suggested_chips = ["रत्नागिरी", "मालवण", "वेरावळ", "मुंबई"]
    elif lang == "hi":
        suggested_chips = ["रत्नागिरी", "मालवण", "वेरावल", "मुंबई"]
    elif lang == "ta":
        suggested_chips = ["தூத்துக்குடி", "சென்னை", "கொச்சி"]
    else:
        suggested_chips = ["Ratnagiri", "Malvan", "Veraval", "Mumbai"]

    recommendation = Recommendation(
        status=RecommendationStatus.INFORMATIONAL,
        summary="Awaiting departure harbor for operational advisory.",
        decisive_factors=[f"Missing critical field: {f}" for f in missing],
        next_action="Specify departure harbor to proceed with analysis.",
    )

    confidence = Confidence(
        level=ConfidenceLevel.LOW,
        reasons=["Operational context incomplete: departure origin unknown."],
    )

    trace = _append_trace(
        trace,
        node_name="Clarification",
        action=f"Requested user clarification for missing operational fields ({', '.join(missing)}) in '{lang}'",
        status="completed",
    )

    return {
        "response": prompt,
        "risk_assessment": recommendation,
        "confidence": confidence,
        "suggested_followups": suggested_chips,
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
    builder.add_node(NodeId.CLARIFICATION.value, clarification_node)
    builder.add_node(NodeId.SUPERVISOR_PLANNER.value, supervisor_node)
    builder.add_node(NodeId.SPECIALIST_TOOLS.value, specialist_tools_node)
    builder.add_node(NodeId.EVIDENCE_VALIDATOR.value, evidence_validator_node)
    builder.add_node(NodeId.RESPONSE_COMPOSER.value, response_composer_node)
    builder.add_node(NodeId.TERMINAL.value, terminal_node)

    # 2. Sequential Bounded Edges with Clarification Gate
    builder.add_edge(START, NodeId.INTENT_LOCALE.value)

    def _route_after_intent(state: ORCAState) -> str:
        if state.get("clarification_needed", False):
            return NodeId.CLARIFICATION.value
        return NodeId.SUPERVISOR_PLANNER.value

    builder.add_conditional_edges(
        NodeId.INTENT_LOCALE.value,
        _route_after_intent,
        {
            NodeId.CLARIFICATION.value: NodeId.CLARIFICATION.value,
            NodeId.SUPERVISOR_PLANNER.value: NodeId.SUPERVISOR_PLANNER.value,
        },
    )

    # Clarification node bypasses specialist tools and routes to Terminal
    builder.add_edge(NodeId.CLARIFICATION.value, NodeId.TERMINAL.value)

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
    tool_mode: str = "demo",
    llm_provider: Optional[LLMProvider] = None,
    llm_mode: str = "auto",
) -> ORCAState:
    """Convenience execution runner to execute a query through the LangGraph pipeline."""
    if tool_mode == "contract_mock":
        from backend.app.agents.integrations.mocks import register_m2_contract_mocks
        register_m2_contract_mocks(tool_registry)

    # Determine LLM provider instance based on mode
    active_provider: Optional[LLMProvider] = None
    if llm_mode == "deterministic":
        active_provider = None
    elif llm_mode == "fake":
        from backend.app.agents.llm import FakeLLMProvider
        active_provider = llm_provider if llm_provider is not None else FakeLLMProvider()
    elif llm_mode == "auto":
        active_provider = llm_provider if llm_provider is not None else get_llm_provider()
    else:
        active_provider = llm_provider

    initial_state: ORCAState = {
        "request_id": f"req-{uuid.uuid4().hex[:8]}",
        "thread_id": thread_id,
        "user_message": user_message,
        "user_profile": (user_context or {}).copy(),
        "tool_mode": tool_mode,
        "llm_provider": active_provider,
        "trace": [],
        "evidence": [],
        "warnings": [],
        "map_layers": [],
        "suggested_followups": [],
    }

    final_state = orca_graph.invoke(initial_state)
    return final_state
