# DEV 3 Ownership, Contracts & Architecture Boundaries

> **Role:** Dev 3 — Agent Orchestration, Conversation & Explainability Lead  
> **Project:** SAMUDRA — Smart Autonomous Marine Understanding, Decision & Risk Assistant  
> **SIH Problem Statement:** 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Organization:** ISRO / Department of Space  
> **Milestone:** M0 — Repository & Agent Architecture  

---

## 1. Executive Summary

Dev 3 is responsible for the cognitive intelligence, conversation orchestration, memory management, prompt engineering, evidence provenance validation, and natural-language explanation layer of SAMUDRA.

SAMUDRA follows a **Modular Monolith** architecture with a strict boundary between **Cognitive Extraction / Orchestration (Dev 3)** and **Deterministic Mathematical / Safety Evaluation (Dev 4)**.

---

## 2. Dev 3 Core Ownership & File Tree

Dev 3 has **exclusive code ownership** over the following components:

```
backend/app/
├── agents/
│   ├── __init__.py          # Agent package export registry
│   ├── state.py             # Shared LangGraph ORCAState (TypedDict with total=False)
│   ├── intent.py            # Controlled IntentCategory enum & entity extraction schemas
│   ├── graph.py             # Node contract specifications & bounded routing rules
│   ├── supervisor.py        # Task planner contract & dependency resolution rules
│   ├── tools.py             # Typed AgentToolRegistry, boundary wrapper & telemetry logger
│   ├── memory.py            # ThreadContext, memory manager & context carry-forward
│   ├── evidence.py          # EvidenceValidator & factual citation tracking
│   ├── response.py          # ResponseComposer & safety invariance enforcement
│   ├── trace.py             # AgentTraceLogger (sanitized public telemetry, no private CoT)
│   └── llm.py               # Provider-agnostic LLMProvider interface
│
└── prompts/
    ├── intent.md            # Intent classification & entity extraction template
    ├── supervisor.md        # Task planning prompt template
    ├── response.md          # Multilingual response composer template
    ├── clarification.md     # Clarification generator template
    └── security.md          # Security guardrails & prompt injection defenses

tests/agent_eval/
├── __init__.py              # Evaluation package exports
├── eval_types.py            # AgentEvalCase schema definition
├── fixtures.py              # Benchmark evaluation cases (S1-S8 + multilingual)
├── test_agent_contracts.py  # Contract and invariance validation test suite
└── README.md                # Evaluation framework documentation

docs/
├── DEV3_ARCHITECTURE.md     # This ownership and boundary specification
└── AGENT_ARCHITECTURE.md    # High-level agent workflow and architecture diagram
```

---

## 3. Cross-Developer Contract Boundaries

### 3.1 What Dev 3 Consumes from Dev 2 (Backend Platform & Integration)
- **Shared API Contracts**: `ChatRequest`, `ChatResponse`, `UserContext`, `MapLayer`, `AgentTraceItem` defined in [`backend/app/contracts/chat.py`](file:///c:/Users/dyara/SAMUDRA/backend/app/contracts/chat.py).
- **Tool Result Contract**: `ToolResult` and `ToolStatus` defined in [`backend/app/contracts/tools.py`](file:///c:/Users/dyara/SAMUDRA/backend/app/contracts/tools.py).
- **External Data Connectors**: Dev 2 provides authenticated, cached, rate-limited connector interfaces to INCOIS, IMD, MOSDAC, and Open-Meteo. Dev 3 consumes normalized domain objects, never raw HTTP payloads.

### 3.2 What Dev 3 Consumes from Dev 4 (Marine, Geo, Risk & Route Intelligence)
- **Marine Tools**: PFZ ranking, chlorophyll/SST queries, distance calculations from origin harbors.
- **Geospatial Tools**: Geofence point-in-polygon and line intersection tests (MPAs, naval zones, IMBL).
- **Deterministic Risk Engine**: The rule engine that evaluates ocean state against craft ceilings to issue immutable `Recommendation` objects (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`).
- **Route Tools**: Multi-route waypoint exposure scoring.

### 3.3 Strict Hard Boundaries — Dev 3 Must NEVER:
1. **Never perform raw HTTP calls or scrape websites directly**: All data fetching is handled by Dev 2 connectors.
2. **Never access the database or write raw SQL queries**: Database persistence is managed by Dev 2 repositories.
3. **Never implement geospatial mathematics or geodesic formulas**: Great-circle distances and polygon intersections belong strictly to Dev 4 (`pyproj`, `Shapely`).
4. **Never hardcode or modify safety thresholds in prompts**: Risk logic belongs to Dev 4. Dev 3's LLM merely explains the result.
5. **Never override a deterministic risk decision**: If Dev 4 outputs `NO_GO`, the response composer cannot soften or contradict it.
6. **Never invent unverified metrics or coordinates**: Every numerical claim must link to an `EvidenceRecord`.
7. **Never expose private chain-of-thought in telemetry**: The trace exposed to users must only contain sanitized milestones.

---

## 4. Contract Stability & RFC Process

Any change to:
- `ORCAState` schema in [`backend/app/agents/state.py`](file:///c:/Users/dyara/SAMUDRA/backend/app/agents/state.py)
- `IntentCategory` enum in [`backend/app/agents/intent.py`](file:///c:/Users/dyara/SAMUDRA/backend/app/agents/intent.py)
- `AgentToolRegistry` in [`backend/app/agents/tools.py`](file:///c:/Users/dyara/SAMUDRA/backend/app/agents/tools.py)

must follow the RFC process documented in `docs/DEVELOPMENT.md` to ensure synchronous alignment across Dev 1, Dev 2, and Dev 4.
