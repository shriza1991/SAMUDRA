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
from backend.app.agents.graph import GRAPH_NODE_REGISTRY, NodeContract, NodeId, RoutingPolicy
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
    # Graph & Nodes
    "NodeId",
    "NodeContract",
    "GRAPH_NODE_REGISTRY",
    "RoutingPolicy",
    # Supervisor
    "TaskPlan",
    "ToolExecutionStep",
    "get_default_plan_for_intent",
    # Tools
    "AgentToolRegistry",
    "ToolDefinition",
    "ToolParameter",
    "ToolExecutionRecord",
    "tool_registry",
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
]
