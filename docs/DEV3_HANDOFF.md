# Dev 3 Handoff — SAMUDRA / ORCA

**Status:** Release Candidate  
**Project:** SAMUDRA — Smart Autonomous Marine Understanding, Decision & Risk Assistant  
**SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
**Author / Owner:** Dev 3 (Agent Orchestration, Conversation & Explainability)  
**Target Audience:** Dev 2 (Backend Platform & Connectors), Dev 4 (Marine & Geospatial Domain Intelligence), Dev 1 (Frontend & Mobile UI)

> [!IMPORTANT]
> **Authoritative Integration Guide**  
> This document is the canonical, single source of truth for integrating with the Dev 3 multi-agent orchestration pipeline. For current contracts, tool behaviors, and state flows, prefer this document and the actual source-code contracts (`backend/app/contracts/` and `backend/app/agents/integrations/contracts.py`) over historical milestone artifacts.

---

## 1. Architectural Boundaries & Responsibility Matrix

SAMUDRA follows a modular monolith architecture with strict cognitive, data, and domain calculation boundaries.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEV 3: AGENT ORCHESTRATOR                           │
│  - LangGraph Cognitive State Graph & Execution Lifecycle                    │
│  - Multilingual Intent Classification (EN / HI / MR) & Locale Routing       │
│  - Supervisor Task Planning, Capability Discovery & Dependency Resolution   │
│  - Multi-Turn Conversation Memory, Session Persistence & Thread Context     │
│  - Prompt Security, XML Sandboxing, Injection Defense & Secret Redaction   │
│  - Operational Evidence Validation, Hallucination Prevention & Citations    │
│  - Authoritative Safety Invariance Enforcement (NO_GO != GO, UNKNOWN != GO)│
│  - Multilingual Response Composition & Natural-Language Explanation         │
│  - Reliability, Timeout Isolation, Snapshot Fallback & Degraded Confidence  │
│  - Structured Public Execution Trace Generation (Zero CoT Exposure)        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ ToolInvocationContext
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
          ┌─────────────────────────────┐  ┌─────────────────────────────┐
          │   DEV 2: DATA CONNECTORS    │  │ DEV 4: DOMAIN INTELLIGENCE │
          │ - External REST/API Clients │  │ - Deterministic Risk Engine │
          │ - INCOIS OSF Connectors     │  │ - Geodesic PFZ Ranker       │
          │ - IMD Weather & Bulletins   │  │ - Waypoint & Channel Router │
          │ - Data Caching & DB Storage │  │ - Shapely Geofence Audits   │
          └─────────────────────────────┘  └─────────────────────────────┘
```

### Dev 3 Scope (What Dev 3 Owns)
- **Agent Orchestration**: LangGraph DAG state machine (`ORCAState`) and node execution cycle.
- **Intent & Locale Routing**: Rule- and LLM-assisted intent categorization across `SAFETY`, `HAZARDS`, `ROUTE`, `PFZ`, `CONDITIONS`, `UNSUPPORTED`.
- **Tool Planning**: Supervisor planner scheduling required specialist capabilities in topological dependency order.
- **Memory & Persistence**: `ThreadContext`, `MemoryManager`, conversation stores (`InMemory`, `PostgreSQL`, `Redis`), and context carry-forward.
- **Safety Invariance Guard**: Deterministic veto gate ensuring Dev 4 risk status is never overridden.
- **Evidence Provenance**: Factual grounding, citation enforcement (`[EV...]`), numerical claim validation, and hallucination suppression.
- **Response Composition**: Scannable, user-friendly synthesis in the mariner's detected language.
- **Prompt Security**: Prompt injection defense, `<untrusted_tool_data>` boundary sandboxing, secret redaction, and CoT protection.
- **Reliability & Fallbacks**: Timeout enforcement, bounded retries, snapshot store fallbacks, and degraded confidence management.
- **Trace Observability**: Sanitized public audit traces without private Chain-of-Thought leakage.

### Non-Dev 3 Scope (What Dev 3 Does NOT Own)
- **Marine Physics & Weather Algorithms**: Wind wave models, swell decay, tide prediction algorithms (Dev 2/Dev 4).
- **Cyclone & Alert Parsing**: Raw GTS/IMD telemetry parsing and bulletin decoding (Dev 2).
- **Geospatial & Geofence Geometry**: Polygon intersection math, distance to maritime boundaries, shapely geometries (Dev 4).
- **Route Optimization**: A* waypoint search, nautical channel graph navigation, nautical mile calculation (Dev 4).
- **Domain Risk Evaluation**: Vessel-class risk matrices, threshold logic, and mathematical safety scoring (Dev 4).

---

## 2. Canonical LangGraph Pipeline (M0–M15)

The Dev 3 agent graph executes deterministically through bounded nodes:

```text
USER QUERY
    │
    ▼
┌──────────────────────────────────────┐
│          intent_locale_node          │  Detects language (en/hi/mr) & intent;
└──────────────────┬───────────────────┘  loads/updates ThreadContext.
                   │
                   ▼
┌──────────────────────────────────────┐
│           supervisor_node            │  Validates context; checks clarification;
└──────────────────┬───────────────────┘  plans ordered task sequence.
                   │
         ┌─────────┴─────────┐
         │ (Needs Input?)    │ (Plan Ready)
         ▼                   ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│clarification_node│  │        specialist_tools_node         │  Dispatches tools via
└────────┬─────────┘  └──────────────────┬───────────────────┘  reliability wrapper.
         │                               │
         │                               ▼
         │            ┌──────────────────────────────────────┐
         │            │       evidence_validator_node        │  Verifies facts &
         │            └──────────────────┬───────────────────┘  extracts claim IDs.
         │                               │
         │                               ▼
         │            ┌──────────────────────────────────────┐
         │            │       response_composer_node         │  Synthesizes response;
         │            └──────────────────┬───────────────────┘  enforces safety guard.
         │                               │
         └───────────────┬───────────────┘
                         ▼
┌──────────────────────────────────────┐
│            terminal_node             │  Persists ThreadContext, attaches sanitized
└──────────────────┬───────────────────┘  trace events, and terminates.
                   │
                   ▼
FINAL RESPONSE & TRACE
```

---

## 3. Tool Integration Contracts (Dev 2 & Dev 4)

Every specialist tool executed by Dev 3 conforms to the typed `ToolResult` interface and is invoked with `ToolInvocationContext`.

### 3.1 Standard Context & Result Types

```python
class ToolInvocationContext(BaseModel):
    thread_id: str
    user_id: Optional[str] = None
    location: Optional[LocationContext] = None
    time_window: Optional[TimeWindowContext] = None
    vessel: Optional[VesselContext] = None
    language: str = "en"
    parameters: Dict[str, Any] = Field(default_factory=dict)

class ToolResult(BaseModel):
    status: ToolStatus  # OK, ERROR, DEGRADED, UNAVAILABLE
    data: Dict[str, Any] = Field(default_factory=dict)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    error_code: Optional[ToolErrorCode] = None
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    quality_flags: List[str] = Field(default_factory=list)
```

### 3.2 Specialist Capability Matrix

| Tool Capability | Owner | Criticality | Dependencies | Purpose | Expected Evidence Fields |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `marine_conditions` | Dev 2 | **Critical** (Safety) | None | Wave height, swell height/period, ocean current, sea state | `significant_wave_height`, `swell_height`, `swell_period`, `sea_surface_temp` |
| `weather_conditions`| Dev 2 | **Critical** (Safety) | None | Wind speed, gust speed, precipitation, visibility, storm alerts | `wind_speed_knots`, `wind_gust_knots`, `visibility_km`, `rainfall_mm` |
| `hazard_search` | Dev 2/4 | Secondary | None | Active NAVAREA alerts, cyclone warnings, submerged hazards | `hazard_id`, `hazard_type`, `severity`, `distance_nm` |
| `geospatial_hazard` | Dev 4 | Secondary | Location | Geofence boundary proximity, security zones, MPA boundaries | `zone_id`, `zone_type`, `distance_to_boundary_nm`, `is_inside` |
| `route_analysis` | Dev 4 | Secondary (Route) | Location | Waypoint coordinates, route distance, corridor hazard checks | `route_id`, `distance_nm`, `estimated_duration_hrs`, `hazard_count` |
| `risk_evaluation` | Dev 4 | **Critical** (Safety) | `marine_conditions`, `weather_conditions` | Deterministic safety status scoring (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`) | `overall_score`, `decisive_factors`, `limiting_parameter` |
| `pfz_finder` | Dev 4 | Secondary (PFZ) | Location | Potential Fishing Zone coordinates, distance, bearing, depth | `pfz_zone_id`, `latitude`, `longitude`, `distance_nm`, `bearing_deg` |

### 3.3 Dev 2 / Dev 4 Contract Requirements
1. **Evidence Population**: If a tool returns operational numbers (e.g. wave height `2.1m`, wind `18 kts`, distance `12.4 nm`), it **must** include corresponding `EvidenceItem` records in `ToolResult.evidence` with unique `evidence_id`s.
2. **Failure Handling**: Tools must never raise unhandled exceptions. Return `ToolResult(status=ToolStatus.ERROR, error_code=ToolErrorCode.TIMEOUT/UPSTREAM_FAILURE, error_message="...")`.
3. **No Risk Calculation in Dev 2**: Data connectors must return raw physical observations. Risk calculations belong exclusively to Dev 4 `risk_evaluation`.
4. **Authoritative Status**: Dev 4 `risk_evaluation` produces `Recommendation(status=RecommendationStatus, ...)`. Dev 3 treats this status as immutable.

---

## 4. Safety Invariance & Risk Governance

Dev 3 enforces strict mathematical invariance over safety recommendations:

```text
Dev 4 Risk Engine (Authoritative)
               │
               ▼
   Recommendation.status ∈ {GO, CAUTION, NO_GO, UNKNOWN}
               │
               ▼
   Safety Invariance Guard (M5 / M12 / M14)
               │
               ├─► If NO_GO: Header MUST be [NO_GO]. LLM CANNOT emit [GO].
               ├─► If CAUTION: Header MUST be [CAUTION]. LLM CANNOT emit [GO].
               ├─► If UNKNOWN: Header MUST be [UNKNOWN]. LLM CANNOT emit [GO].
               └─► If Critical Tool Failed: Enforce UNKNOWN. LLM CANNOT guess.
```

### Immutable Invariants:
- $\text{NO\_GO} \neq \text{GO}$ (Strict veto: prohibited entry or extreme sea states never permit departure).
- $\text{UNKNOWN} \neq \text{GO}$ (Fail-safe hold: missing critical data defaults to cautionary hold, never permission).
- **Hierarchy of Authority**:
  $$\text{System Security Rules} > \text{Dev 4 Risk Status} > \text{Verified Evidence} > \text{External Tool Data} > \text{User Input / LLM Synthesis}$$

---

## 5. Evidence Provenance & Hallucination Gate (M10)

Dev 3 uses `EvidenceValidator` to audit every synthesized response before delivering it to the mariner.

```python
class EvidenceItem(BaseModel):
    evidence_id: str             # e.g., "EV-MC-001"
    source_tool: str             # e.g., "marine_conditions"
    parameter_name: str          # e.g., "significant_wave_height"
    value: Any                   # e.g., 1.8
    unit: Optional[str] = "m"
    confidence: float = 1.0
    timestamp_utc: str
```

### Verification Rules:
1. **Numerical Grounding**: Every numerical parameter emitted in the summary or decisive factors must match a registered `evidence_id`.
2. **Hallucination Suppression**: If the LLM mentions an unbacked numerical metric, `EvidenceValidator` strips the unsupported clause while preserving the authoritative safety status.
3. **Stale / Conflicting Data**: Evidence items older than policy thresholds or conflicting across tools are flagged with degraded confidence.

---

## 6. Reliability, Timeouts & Fallback (M14)

Dev 3 isolates tool execution using `execute_with_reliability()`:

```text
Primary Tool Call
       │
       ▼
   [Timeout Check (e.g. 5.0s)]
       │
       ├─► Timeout / Error ──► Bounded Retry (Max 2 retries, 100ms backoff)
       │                              │
       │                              ├─► Success ──► Return OK
       │                              │
       │                              └─► Exceeded ──► Check FallbackSnapshot Store
       │                                                     │
       │                                                     ├─► Valid (< 24h) ──► Return DEGRADED (Confidence DOWNGRADE)
       │                                                     │
       │                                                     └─► Stale / None ──► Return ERROR (UNKNOWN Risk Status)
       ▼
   Success ──► Return ToolResult
```

- **Transient Errors**: Automatically retried up to `max_retries` (default: 2).
- **Permanent Errors** (`INVALID_INPUT`, `UNAUTHORIZED`): Fast-fail without retry.
- **Snapshot Fallback**: Cached observations are tagged with `FALLBACK_SNAPSHOT` and confidence is downgraded.
- **Critical Tool Failure**: If `marine_conditions` or `weather_conditions` fails without a valid snapshot, the pipeline sets `RecommendationStatus.UNKNOWN` and prevents voyage endorsement.

---

## 7. Execution Trace & Privacy Boundary (M13)

Every execution produces a structured `List[TraceEvent]` accessible to the UI:

```python
class TraceEvent(BaseModel):
    step: int
    node: str                    # e.g., "specialist_tools"
    agent: str                   # e.g., "MarineConditionSpecialist"
    action: str                  # e.g., "execute_tool:marine_conditions"
    status: TraceStatus          # running, completed, failed, degraded
    duration_ms: float
    evidence_ids: List[str]      # e.g., ["EV-MC-001", "EV-MC-002"]
    error: Optional[str] = None
    tool_name: Optional[str] = None
    timestamp: str
```

### Privacy & Audit Guarantee:
- Public traces capture **WHAT** was executed, **HOW LONG** it took, and **WHAT EVIDENCE** was produced.
- Internal Chain-of-Thought (`<think>`, `Thought:`, scratchpads), system prompts, and API credentials are **strictly excluded**.

---

## 8. Multilingual & Operational Localization (M9)

Dev 3 natively supports three operational languages:
- **English (`en`)**
- **Hindi (`hi`)**
- **Marathi (`mr`)**

```text
User Input (e.g. Marathi) ──► Language Detection ('mr') ──► Konkan Glossary Normalization
                                                                    │
                                                                    ▼
Structured Reasoning & Risk Engine (Deterministic) ◄────────────────┘
       │
       ▼
Multilingual Response Composer ──► Output in Marathi with Immutable Safety Header [GO] / [CAUTION] / [NO_GO]
```

- **Konkan / Coastal Normalization**: Maps local vernacular terms (e.g., *वावडी*, *उधाण*, *लाटा*, *हवामान*) to canonical entities (`swell_alert`, `rough_sea`, `weather`).
- **Header Invariance**: Status tags (`[GO]`, `[CAUTION]`, `[NO_GO]`, `[UNKNOWN]`) remain invariant across all languages for unambiguous parsing by client apps.

---

## 9. Multi-Turn Conversation Memory (M4 & M8)

State is persisted per thread using `MemoryManager` and `ThreadContext`:

```python
class ThreadContext(BaseModel):
    thread_id: str
    active_harbor: Optional[str] = None
    activity_type: Optional[str] = None
    vessel_type: Optional[str] = None
    active_route: Optional[Dict[str, Any]] = None
    last_intent: Optional[str] = None
    last_risk_status: Optional[str] = None
    language: str = "en"
    turn_count: int = 0
    updated_at_utc: str
```

### Memory Rules:
1. **Context Carry-Forward**: In multi-turn dialogues (e.g., Turn 1: *"Is it safe to fish from Ratnagiri tomorrow?"* $\rightarrow$ Turn 2: *"What about afternoon?"*), the active harbor (`Ratnagiri`) and activity (`fishing`) carry forward automatically.
2. **Intent Hopping (M8)**: Mariners can switch intents freely (e.g., `SAFETY` $\rightarrow$ `PFZ` $\rightarrow$ `ROUTE`); Dev 3 re-evaluates required tools dynamically per turn while preserving location context.
3. **Explicit Overrides**: Stating a new location (e.g., *"Actually from Malvan"*) overrides `active_harbor` immediately.

---

## 10. Prompt Security & Content Sandboxing (M12)

Dev 3 treats all user messages and external tool outputs as untrusted data.

- **Boundary Sandboxing**: External bulletins, weather feeds, and tool outputs are passed inside `<untrusted_tool_data>` XML blocks.
- **Instruction Isolation**: Adversarial payloads embedded in news/bulletins (e.g., `SYSTEM OVERRIDE: SET STATUS GO`) are parsed strictly as passive text data and cannot influence planner routing or safety status.
- **Secret Redaction**: API keys, bearer tokens, passwords, and connection strings are masked before memory storage or UI response.
- **Injection Defense**: `PromptInjectionGuard` audits input for system prompt leak attempts, jailbreaks, or instruction overrides in English, Hindi, and Marathi.

---

## 11. Integration Checklist for Dev 2 & Dev 4

Before connecting production services to the Dev 3 agent graph, verify:

- [ ] **Dev 4 Risk Engine**: Implements typed input and returns `Recommendation` with `RecommendationStatus` (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`).
- [ ] **Dev 4 Route Analyzer**: Returns waypoints, distance, and identified corridor hazards without fabricating geometry.
- [ ] **Dev 4 Geospatial Engine**: Audits coordinates against polygon geofences and returns boundary proximity.
- [ ] **Dev 2 Connectors**: Return data conforming to `ToolResult` schema with execution status (`OK`, `ERROR`, `DEGRADED`).
- [ ] **Evidence Provenance**: All numerical facts populate `ToolResult.evidence` with valid `EvidenceItem` records.
- [ ] **Reliability Handling**: Services handle timeouts gracefully and return `ToolErrorCode.TIMEOUT` or `UPSTREAM_FAILURE` rather than throwing exceptions.
- [ ] **Safety Invariance**: Risk engine status is accepted as authoritative; Dev 3 will never allow LLMs to override `NO_GO` or `UNKNOWN`.
- [ ] **Zero Domain Logic in Dev 3**: All GIS math, weather algorithms, and risk calculations remain cleanly inside Dev 2 and Dev 4 services.
