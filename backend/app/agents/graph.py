"""LangGraph Node Contracts & Routing Architecture Specification for SAMUDRA / ORCA.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

NOTE: This module defines the architecture, typed interfaces, state mutation permissions,
and routing contracts for Milestone M0. Actual LangGraph node logic and edge compilation
will be implemented in Milestone M1.
"""

from enum import Enum
from typing import Dict, List
from pydantic import BaseModel, Field



# =============================================================================
# Graph Node Identifiers
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


# =============================================================================
# Node Contract Specification & Permissions
# =============================================================================

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
        description=(
            "Normalizes user query, detects ISO language code, extracts spatio-temporal "
            "and craft entities, identifies missing fields, and checks if clarification is needed."
        ),
        inputs=["user_message", "user_profile", "thread_id"],
        allowed_mutations=[
            "language",
            "intent",
            "location",
            "time_window",
            "missing_fields",
            "clarification_needed",
            "clarification_prompt",
            "trace",
        ],
        forbidden_actions=[
            "Do NOT calculate wave heights or risk status.",
            "Do NOT invent coordinates not provided by user or context.",
            "Do NOT call external APIs or databases.",
        ],
    ),
    NodeId.CLARIFICATION: NodeContract(
        node_id=NodeId.CLARIFICATION,
        name="Clarification Node",
        description=(
            "Formulates a brief, polite, localized clarification request when critical "
            "operational parameters (e.g. origin harbor or trip time) are completely missing."
        ),
        inputs=["missing_fields", "language", "intent"],
        allowed_mutations=["clarification_prompt", "response", "trace"],
        forbidden_actions=[
            "Do NOT execute domain tools before clarification is received.",
            "Do NOT generate hallucinated default parameters without user confirmation.",
        ],
    ),
    NodeId.SUPERVISOR_PLANNER: NodeContract(
        node_id=NodeId.SUPERVISOR_PLANNER,
        name="Supervisor / Task Planner Node",
        description=(
            "Inspects classified intent and spatio-temporal context to construct a bounded, "
            "dependency-ordered list of specialist tools to run."
        ),
        inputs=["intent", "location", "time_window", "user_profile"],
        allowed_mutations=["task_plan", "trace"],
        forbidden_actions=[
            "Do NOT execute tools directly within the planner.",
            "Do NOT plan arbitrary tools outside the approved tool registry.",
            "Do NOT create unbound, open-ended loops.",
        ],
    ),
    NodeId.SPECIALIST_TOOLS: NodeContract(
        node_id=NodeId.SPECIALIST_TOOLS,
        name="Specialist Tool Execution Node",
        description=(
            "Dispatches planned tools to registered deterministic handlers (marine conditions, "
            "weather alerts, PFZ retrieval, geospatial fences, route generation). Executes independent "
            "tools in parallel and standardizes outputs into ToolResult."
        ),
        inputs=["task_plan", "location", "time_window", "user_profile"],
        allowed_mutations=[
            "tool_results",
            "observations",
            "advisories",
            "pfz_candidates",
            "route_candidates",
            "evidence",
            "warnings",
            "trace",
        ],
        forbidden_actions=[
            "Do NOT execute arbitrary unapproved code or shell commands.",
            "Do NOT allow tools to mutate core session identifiers.",
            "Do NOT ignore tool failure states without recording warnings.",
        ],
    ),
    NodeId.RISK_EVALUATION: NodeContract(
        node_id=NodeId.RISK_EVALUATION,
        name="Risk Evaluation Handoff Node",
        description=(
            "Passes collected observations, advisories, and craft limits to the deterministic "
            "Risk Evaluation Engine (Dev 4) to obtain an immutable safety decision."
        ),
        inputs=["observations", "advisories", "route_candidates", "user_profile"],
        allowed_mutations=["risk_assessment", "confidence", "warnings", "trace"],
        forbidden_actions=[
            "Do NOT allow the LLM to modify or soften the risk status (GO/CAUTION/NO_GO).",
            "Do NOT bypass the deterministic risk engine when weather data is present.",
        ],
    ),
    NodeId.EVIDENCE_VALIDATOR: NodeContract(
        node_id=NodeId.EVIDENCE_VALIDATOR,
        name="Evidence Validator Node",
        description=(
            "Audits the collected evidence against claims. Ensures every numerical metric "
            "(wave height, wind speed, distance) has an unexpired, traceable citation."
        ),
        inputs=["evidence", "observations", "risk_assessment"],
        allowed_mutations=["evidence", "confidence", "warnings", "trace"],
        forbidden_actions=[
            "Do NOT allow ungrounded numerical claims to pass without a quality flag or warning.",
            "Do NOT delete evidence items from official issuing authorities.",
        ],
    ),
    NodeId.RESPONSE_COMPOSER: NodeContract(
        node_id=NodeId.RESPONSE_COMPOSER,
        name="Response Composer Node",
        description=(
            "Synthesizes verified observations, deterministic risk recommendation, and evidence "
            "into a natural-language, localized explanation in the user's detected language."
        ),
        inputs=[
            "language",
            "intent",
            "risk_assessment",
            "observations",
            "evidence",
            "warnings",
            "pfz_candidates",
            "route_candidates",
        ],
        allowed_mutations=["response", "map_layers", "suggested_followups", "trace"],
        forbidden_actions=[
            "Do NOT override the deterministic recommendation status (GO/CAUTION/NO_GO).",
            "Do NOT invent wave heights, distances, or safety limits.",
            "Do NOT output text in a language different from the detected/requested language.",
            "Do NOT expose private internal chain-of-thought in the final response.",
        ],
    ),
    NodeId.TERMINAL: NodeContract(
        node_id=NodeId.TERMINAL,
        name="Terminal / Finalization Node",
        description=(
            "Bundles state into the final ChatResponse, seals the sanitized execution trace, "
            "validates required response fields, and outputs to the caller."
        ),
        inputs=["response", "risk_assessment", "evidence", "map_layers", "trace", "warnings"],
        allowed_mutations=["trace"],
        forbidden_actions=[
            "Do NOT return without a valid response or clarification string.",
            "Do NOT include unsanitized reasoning tokens in telemetry.",
        ],
    ),
}


# =============================================================================
# Graph Routing & Loop Guard Contracts
# =============================================================================

class RoutingPolicy(BaseModel):
    """Enforces safety limits and invariants on LangGraph edge traversal."""

    max_execution_steps: int = Field(
        15, description="Upper bound on total node executions to prevent infinite cycles"
    )
    max_clarification_turns: int = Field(
        2, description="Maximum clarification prompts before falling back to generic guidance"
    )
    allow_parallel_specialist_execution: bool = Field(
        True, description="Enable concurrent dispatch for independent tools (e.g. weather + PFZ)"
    )
    enforce_evidence_gate: bool = Field(
        True, description="Response composer cannot execute if evidence validation fails"
    )


ROUTING_SPECIFICATION = """
===============================================================================
SAMUDRA / ORCA Graph Routing Topology (Deterministic & Bounded)
===============================================================================

           [START]
              │
              ▼
      ┌───────────────┐
      │ Intent/Locale │
      └───────┬───────┘
              │
              ▼
      {Clarification?}
       ├── YES ──► [Clarification Node] ──► [Terminal / Return to User]
       │
       └── NO
           │
           ▼
      ┌───────────────────┐
      │Supervisor/Planner │
      └─────────┬─────────┘
                │
                ▼
      ┌───────────────────────────────┐
      │   Specialist Tool Execution   │
      │   (Parallel where independent)│
      └─────────┬─────────────────────┘
                │
                ▼
      {Requires Risk Eval?}
       ├── YES ──► [Risk Evaluation Handoff (Dev 4 Engine)]
       │                  │
       └── NO  ───────────┘
                │
                ▼
      ┌───────────────────┐
      │Evidence Validator │
      └─────────┬─────────┘
                │
                ▼
      ┌───────────────────┐
      │ Response Composer │
      └─────────┬─────────┘
                │
                ▼
      ┌───────────────────┐
      │Terminal / Finalize│
      └─────────┬─────────┘
                │
                ▼
              [END]

Guarantees:
1. No Infinite Loops: Max steps strictly bounded to 15.
2. No Bypassed Safety: If weather/marine tools run, Risk Evaluation MUST run.
3. No Hallucinated Claims: Evidence Validator MUST run before Response Composer.
4. Deterministic Primacy: Risk decision is computed by Dev 4, LLM only explains it.
===============================================================================
"""
