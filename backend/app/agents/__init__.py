"""LangGraph Agentic Orchestrator Package for SAMUDRA / ORCA.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

Responsible for:
- LangGraph StateGraph pipeline (ORCAState)
- Controlled Intent Taxonomy & Locale Detection
- Supervisor / Task Planner
- Typed Specialist Tool Registry & boundary wrapper
- Multi-turn conversation memory with selective carry-forward
- Evidence verification gate & provenance citations
- Multilingual response composition & safety invariance
- Non-leaking activity trace generation
- Provider-agnostic LLM interface

Must NOT implement:
- Math / geospatial distance calculations (calls Dev 4 tools)
- Risk threshold evaluations (calls Dev 4 risk engine)
- Direct external HTTP calls (calls Dev 2 connectors)
"""

from backend.app.agents.evidence import EvidenceRecord, EvidenceValidationReport, EvidenceValidator
from backend.app.agents.graph import (
    GRAPH_NODE_REGISTRY,
    NodeContract,
    NodeId,
    RoutingPolicy,
    build_orca_graph,
    orca_graph,
    run_orca_graph,
)
from backend.app.agents.integrations import (
    CAPABILITIES_CATALOG,
    ProviderToolAdapter,
    ToolErrorCode,
    ToolInvocationContext,
    ToolOwner,
    register_m2_contract_mocks,
)
from backend.app.agents.intent import (
    ExtractedEntities,
    IntentCategory,
    IntentExtractionResult,
    normalize_intent,
)
from backend.app.agents.llm import LLMMessage, LLMProvider, LLMResponse, MessageRole
from backend.app.agents.memory import MemoryManager, ThreadContext, memory_manager
from backend.app.agents.response import ResponseComposer, ResponseCompositionInput
from backend.app.agents.state import AgentState, ORCAState
from backend.app.agents.stub_tools import (
    explanation_stub,
    marine_stub,
    pfz_stub,
    risk_stub,
    route_stub,
    weather_stub,
)
from backend.app.agents.supervisor import TaskPlan, ToolExecutionStep, get_default_plan_for_intent
from backend.app.agents.tools import (
    AgentToolRegistry,
    ToolDefinition,
    ToolExecutionRecord,
    ToolParameter,
    tool_registry,
)
from backend.app.agents.trace import AgentTraceLogger, TraceEvent, TraceStatus

__all__ = [
    # State
    "ORCAState",
    "AgentState",
    # Intent
    "IntentCategory",
    "ExtractedEntities",
    "IntentExtractionResult",
    "normalize_intent",
    # Graph & Executable Workflow
    "NodeId",
    "NodeContract",
    "GRAPH_NODE_REGISTRY",
    "RoutingPolicy",
    "build_orca_graph",
    "orca_graph",
    "run_orca_graph",
    # Supervisor
    "TaskPlan",
    "ToolExecutionStep",
    "get_default_plan_for_intent",
    # Tools & Registry
    "AgentToolRegistry",
    "ToolDefinition",
    "ToolParameter",
    "ToolExecutionRecord",
    "tool_registry",
    # Stub Tools (M1)
    "pfz_stub",
    "marine_stub",
    "weather_stub",
    "risk_stub",
    "route_stub",
    "explanation_stub",
    # Memory
    "ThreadContext",
    "MemoryManager",
    "memory_manager",
    # Evidence
    "EvidenceRecord",
    "EvidenceValidationReport",
    "EvidenceValidator",
    # Response
    "ResponseComposer",
    "ResponseCompositionInput",
    # Trace
    "TraceStatus",
    "TraceEvent",
    "AgentTraceLogger",
    # LLM Abstraction
    "LLMProvider",
    "LLMMessage",
    "LLMResponse",
    "MessageRole",
    # M2 Integrations & Contracts
    "ToolOwner",
    "ToolErrorCode",
    "ToolInvocationContext",
    "CAPABILITIES_CATALOG",
    "ProviderToolAdapter",
    "register_m2_contract_mocks",
]
