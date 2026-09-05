# Dev 3 (Agent Orchestration, Conversation & Explainability) Progress Tracker

> **Project:** SAMUDRA — Smart Autonomous Marine Understanding, Decision & Risk Assistant  
> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Role:** Dev 3 Lead  

---

## Milestone Status Overview

| Milestone | Scope | Status | Verification Result |
| :--- | :--- | :--- | :--- |
| **M0** | Repository & Agent Architecture | **COMPLETE** | All typed contracts, state schema, registries, prompt specs, and evaluation fixtures defined. |
| **M1** | Basic Agent Graph (Vertical Slice) | **COMPLETE** | Executable LangGraph pipeline running on in-memory stub tools with evidence validation, safety invariance, and sanitized traces. 24/24 tests passing. |
| **M2** | Integration Contracts & Orchestration Hardening | **COMPLETE** | Typed Dev 2/Dev 4 protocols, ProviderToolAdapter, contract mocks tagged M2_CONTRACT_MOCK, capability discovery, error semantics, handoff guides. 41/41 tests passing. |
| **M3** | LLM Provider Integration | **COMPLETE** | Provider-agnostic LLM interface, Fake/Ollama/OpenAI providers, prompt injection guard, XML sandboxing, zero CoT leakage, safety invariance, fallback resilience. 65/65 tests passing. |
| **M4** | Multi-Turn Memory & State Persistence | **COMPLETE** | ThreadContext, selective carry-forward, ConversationStore abstraction (InMemory, PostgreSQL, Redis), data sanitization. 88/88 tests passing. |
| **M5** | Safety Reasoning Flow | **COMPLETE** | End-to-end voyage safety flow, DAG dependency order, conservative upstream failure handling, authoritative Dev 4 status invariance, evidence grounding, multilingual advisories. 116/116 tests passing. |
| **M6** | Hazard & Geofence Flow | **COMPLETE** | Multi-domain hazard/geofence planning, boundary distance checks, hard-stop NO_GO and restricted CAUTION rules, multilingual explanations. 144/144 tests passing. |
| **M7** | Route Reasoning Flow | **COMPLETE** | Route comparison pipeline, candidate preservation, Dev 4 recommended route highlighting, invariant risk headers, localized comparisons. 189/189 tests passing. |
| **M8** | Intent Switching Across Turns | **COMPLETE** | Dynamic intent hopping (SAFETY ↔ HAZARDS ↔ ROUTE ↔ PFZ), selective context carry-forward, fresh tool dispatch per turn, thread isolation. 204/204 tests passing. |
| **M9** | Multilingual / Local-Language Pipeline | **COMPLETE** | Script and token-based language detection (en, mr, hi), bounded coastal/Konkan normalization glossary, LLM-assisted multilingual NLU + response generation, multi-turn language switching, strict safety status invariance. 239/239 tests passing. |
| **M10** | Evidence Validation & Hallucination Prevention | **COMPLETE** | Deterministic numerical claim extraction across EN/HI/MR, claim-to-evidence mapping, citation enforcement ([EV...]), stale/conflict detection, partial evidence support, selective clause-level hallucination suppression, safety invariance preservation, 100% offline FakeLLM testing. 265/265 tests passing. |
| **M11** | Response Composer & Operational Presentation | **COMPLETE** | 10 core M11 requirements implemented: recommendation status, concise summary, decisive factors, suggested next action, confidence explanation, evidence references, warnings, suggested follow-ups, same-language output (EN/MR/HI/TA), and concise scannable format. Strict safety/evidence/language invariants preserved. 281/281 tests passing. |
| **M12** | Prompt Security & Untrusted Content Isolation | **COMPLETE** | PromptInjectionGuard enhanced with comprehensive injection/jailbreak detection across EN/HI/MR, XML boundary sandboxing (<untrusted_tool_data>), tool-result instruction isolation, secret & credential redaction, raw CoT prevention, output safety tampering defense, safe refusal handling, 100% M0–M11 regression passing. 305/305 tests passing. |

---

## Detailed Milestone Logs

### M0 — Repository & Agent Architecture (COMPLETE)
- **Delivered**:
  - `ORCAState(TypedDict)` with `AgentState = ORCAState` alias in `backend/app/agents/state.py`.
  - Controlled `IntentCategory` enum & taxonomy in `backend/app/agents/intent.py`.
  - 7 LangGraph Node contracts & permissions in `backend/app/agents/graph.py`.
  - Supervisor planning architecture in `backend/app/agents/supervisor.py`.
  - Typed `AgentToolRegistry` & telemetry wrapper in `backend/app/agents/tools.py`.
  - Memory architecture (`ThreadContext`, `MemoryManager`) in `backend/app/agents/memory.py`.
  - Evidence provenance contracts (`EvidenceValidator`) in `backend/app/agents/evidence.py`.
  - Response composer invariants & safety rules in `backend/app/agents/response.py`.
  - Sanitized trace logger (`AgentTraceLogger`) in `backend/app/agents/trace.py`.
  - Provider-agnostic LLM interface in `backend/app/agents/llm.py`.
  - 5 prompt template placeholders in `backend/app/prompts/`.
  - 9 benchmark evaluation fixtures (S1-S8 + Marathi) in `tests/agent_eval/fixtures.py`.
  - Full documentation in `docs/DEV3_ARCHITECTURE.md` and `docs/AGENT_ARCHITECTURE.md`.

---

### M1 — Basic Agent Graph / First End-to-End Vertical Slice (COMPLETE)
- **Delivered**:
  - **In-Memory Stub Tools** in `backend/app/agents/stub_tools.py`:
    * `pfz_stub`: Simulated PFZ candidates (12.4 nm bearing 285° from harbor).
    * `marine_stub`: Simulated ocean state forecast (wave height 1.8m, swell 8.5s).
    * `weather_stub`: Simulated coastal weather and storm warning alerts.
    * `risk_stub`: Simulated deterministic safety evaluation (`CAUTION` status for 1.8m waves).
    * `route_stub`: Simulated comparative passage scoring (Inshore vs Deepwater).
    * `explanation_stub`: Simulated environmental buffer zone justification.
  - **Executable LangGraph Pipeline** in `backend/app/agents/graph.py`:
    * Nodes: `intent_locale`, `supervisor`, `specialist_tools`, `evidence_validator`, `response_composer`, `terminal`.
    * Sequential bounded routing: `START -> intent_locale -> supervisor -> specialist_tools -> evidence_validator -> response_composer -> terminal -> END`.
    * Runner: `run_orca_graph(user_message, thread_id, user_context) -> ORCAState`.
  - **Safety Invariance Enforced**: `ResponseComposer.validate_safety_invariance()` prevents overriding `risk_stub` recommendation status.
  - **Evidence Provenance Gate**: `EvidenceValidator` audits citations, tagging all demo metrics with `M1_DEMO_DATA` and `SIMULATED`.
  - **Sanitized Execution Trace**: `AgentTraceItem` logging without chain-of-thought exposure.
  - **Automated Test Suite** in `tests/agent_eval/test_m1_graph.py`: 9 comprehensive test cases verifying PFZ, SAFETY, CONDITIONS, and UNSUPPORTED flows.
  - **Test Verification**: 24/24 passing tests in 0.51s across the repository.

---

### M2 — Integration Contracts, Tool Interfaces & Orchestration Hardening (COMPLETE)
- **Delivered**:
  - **Contract Definitions** in `backend/app/agents/integrations/contracts.py`:
    * `ToolOwner` enum (`DEV2`, `DEV3`, `DEV4`).
    * `ToolErrorCode` enum with semantic properties (`is_retryable`, `requires_clarification`, `is_user_safe`).
    * `ToolInvocationContext` typed schema.
    * `CAPABILITIES_CATALOG` capability taxonomy.
  - **Interface Protocols & Schemas**:
    * Dev 2 (`backend/app/agents/integrations/dev2.py`): `MarineConditionsPayload`, `WeatherConditionsPayload`, `HazardBulletinPayload`, `PFZSourceDataPayload`, and typed `@runtime_checkable` protocols.
    * Dev 4 (`backend/app/agents/integrations/dev4.py`): `RiskAssessmentPayload`, `PFZRankingPayload`, `RouteExposurePayload`, `GeospatialHazardPayload`, and typed protocols.
  - **Tool Adapters** in `backend/app/agents/integrations/adapters.py`:
    * `ProviderToolAdapter` normalizing external provider outputs into `ToolResult`.
    * Standardized `EvidenceItem` generation with provenance quality flags.
  - **M2 Contract Mocks** in `backend/app/agents/integrations/mocks.py`:
    * `MockMarineConditionsProvider`, `MockWeatherProvider`, `MockHazardProvider`, `MockPFZSourceProvider`.
    * `MockRiskEngine`, `MockPFZRankingEngine`, `MockRouteExposureEngine`, `MockGeospatialHazardEngine`.
    * Stamped with `["M2_CONTRACT_MOCK", "SIMULATED"]`.
    * Registration helper `register_m2_contract_mocks()`.
  - **Hardened Tool Registry & Graph**:
    * Capability availability discovery and toggling (`is_capability_available`, `get_unavailable_capabilities`).
    * Input context field validation (`required_context_fields`).
    * Supervisor dependency ordering (`marine_conditions` -> `weather_conditions` -> `hazard_search` -> `risk_evaluation`).
    * `run_orca_graph(..., tool_mode="contract_mock")` support.
    * Safe failure handling when capabilities are unavailable (`RecommendationStatus.UNKNOWN`).
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m2_integration.py` (17 tests covering ownership, capabilities, adapters, mocks, errors, dependency ordering, telemetry).
    * Total test count: 41/41 passing in 0.65s.
  - **Documentation & Handoff Guides**:
    * `docs/DEV2_DEV4_INTEGRATION_CONTRACT.md`: Master integration contract.
    * `docs/DEV2_IMPLEMENTATION_GUIDE.md`: Step-by-step connector implementation guide.
    * `docs/DEV4_IMPLEMENTATION_GUIDE.md`: Step-by-step risk/PFZ/route engine implementation guide.
    * `docs/M2_TOOL_INTEGRATION.md`: Milestone M2 architecture summary.

---

### M3 — LLM Provider Integration & LLM-Assisted Agent Orchestration (COMPLETE)
- **Delivered**:
  - **Provider-Agnostic LLM Interface** in `backend/app/agents/llm.py`:
    * Abstract base class `LLMProvider` requiring `generate()` and `generate_structured()`.
    * `FakeLLMProvider` for deterministic, zero-cost, 100% offline testing with fault simulation (`simulate_timeout`, `simulate_failure`, `simulate_malformed`).
    * `OllamaLLMProvider` for free local open-weights inference (e.g. Llama 3) via HTTP (`httpx`).
    * `OpenAILLMProvider` for OpenAI-compatible HTTP endpoints.
    * Factory function `get_llm_provider()` with environment-driven fallback.
  - **Prompt Injection Defense & Security** in `backend/app/agents/security.py`:
    * `PromptInjectionGuard`: Regex pattern detection for jailbreak and instruction overrides.
    * Input sandboxing: Wraps user prompts in `<user_input>` XML tags and strips delimiter injection.
    * Response safety auditing: Scans generated text to ensure models never claim safe voyage when deterministic status is `NO_GO` or `CAUTION`.
  - **Structured Cognitive Models** in `backend/app/agents/intent.py`:
    * `LLMTaskPlanProposal`: Structured tool scheduling with `planning_rationale` (strictly no chain-of-thought).
    * `LLMClarificationProposal`: Structured clarification request with missing fields and suggested quick chips.
    * `LLMResponseDraft`: Grounded multilingual synthesis draft.
  - **Prompt Management** in `backend/app/prompts/`:
    * `load_prompt()` loader with LRU caching in `backend/app/prompts/__init__.py`.
    * Production prompt templates: `intent.md`, `supervisor.md`, `response.md`, `clarification.md`.
  - **Graph Node Upgrades** in `backend/app/agents/graph.py`:
    * `intent_locale_node`: LLM extraction with sandboxed input and seamless fallback to deterministic classifier.
    * `supervisor_node`: LLM task plan validation against tool registry capabilities and strict dependency ordering.
    * `response_composer_node`: LLM multilingual drafting with safety invariance enforcement and trace telemetry logging.
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m3_llm.py` (24 test cases covering interface contracts, fake provider, injection defense, planning, safety invariance, evidence grounding, fallback paths, trace telemetry, and backward compatibility).
    * Total test count: 65/65 passing in 0.76s across the entire repository.
    * Linting: 0 ruff errors.
  - **Documentation**:
    * `docs/M3_LLM_INTEGRATION.md`: Architecture overview and verification summary.
    * `docs/LLM_PROVIDER_GUIDE.md`: Developer guide for configuring and deploying local Ollama or cloud providers.

---

## Upcoming Milestones

| **M4** | Multi-Turn Memory & State Persistence | **COMPLETE** | ThreadContext, ConversationStore abstraction, InMemory/PostgreSQL/Redis adapters, selective carry-forward policy, explicit user overrides, temporal expiration, domain freshness. 88/88 tests passing. |
| **M5** | Safety Reasoning Flow | **COMPLETE** | Authoritative safety orchestration via Dev 4 RiskEvaluationEngine, strict DAG ordering, conservative fallback, safety invariance guardrails, multilingual response synthesis. 116/116 tests passing. |
| **M6** | Hazard & Geofence Flow | **COMPLETE** | Geofence capability selection (`geospatial_hazard`), route context resolution, multi-domain orchestration (hazard, geofence, route), hard-stop (`NO_GO`) and restricted-zone (`CAUTION`) enforcement, multilingual evidence grounding. 144/144 tests passing. |

---

## Detailed Milestone Logs

### M0 — Repository & Agent Architecture (COMPLETE)
- **Delivered**:
  - `ORCAState(TypedDict)` with `AgentState = ORCAState` alias in `backend/app/agents/state.py`.
  - Controlled `IntentCategory` enum & taxonomy in `backend/app/agents/intent.py`.
  - 7 LangGraph Node contracts & permissions in `backend/app/agents/graph.py`.
  - Supervisor planning architecture in `backend/app/agents/supervisor.py`.
  - Typed `AgentToolRegistry` & telemetry wrapper in `backend/app/agents/tools.py`.
  - Memory architecture (`ThreadContext`, `MemoryManager`) in `backend/app/agents/memory.py`.
  - Evidence provenance contracts (`EvidenceValidator`) in `backend/app/agents/evidence.py`.
  - Response composer invariants & safety rules in `backend/app/agents/response.py`.
  - Sanitized trace logger (`AgentTraceLogger`) in `backend/app/agents/trace.py`.
  - Provider-agnostic LLM interface in `backend/app/agents/llm.py`.
  - 5 prompt template placeholders in `backend/app/prompts/`.
  - 9 benchmark evaluation fixtures (S1-S8 + Marathi) in `tests/agent_eval/fixtures.py`.
  - Full documentation in `docs/DEV3_ARCHITECTURE.md` and `docs/AGENT_ARCHITECTURE.md`.

---

### M1 — Basic Agent Graph / First End-to-End Vertical Slice (COMPLETE)
- **Delivered**:
  - **In-Memory Stub Tools** in `backend/app/agents/stub_tools.py`:
    * `pfz_stub`: Simulated PFZ candidates (12.4 nm bearing 285° from harbor).
    * `marine_stub`: Simulated ocean state forecast (wave height 1.8m, swell 8.5s).
    * `weather_stub`: Simulated coastal weather and storm warning alerts.
    * `risk_stub`: Simulated deterministic safety evaluation (`CAUTION` status for 1.8m waves).
    * `route_stub`: Simulated comparative passage scoring (Inshore vs Deepwater).
    * `explanation_stub`: Simulated environmental buffer zone justification.
  - **Executable LangGraph Pipeline** in `backend/app/agents/graph.py`:
    * Nodes: `intent_locale`, `supervisor`, `specialist_tools`, `evidence_validator`, `response_composer`, `terminal`.
    * Sequential bounded routing: `START -> intent_locale -> supervisor -> specialist_tools -> evidence_validator -> response_composer -> terminal -> END`.
    * Runner: `run_orca_graph(user_message, thread_id, user_context) -> ORCAState`.
  - **Safety Invariance Enforced**: `ResponseComposer.validate_safety_invariance()` prevents overriding `risk_stub` recommendation status.
  - **Evidence Provenance Gate**: `EvidenceValidator` audits citations, tagging all demo metrics with `M1_DEMO_DATA` and `SIMULATED`.
  - **Sanitized Execution Trace**: `AgentTraceItem` logging without chain-of-thought exposure.
  - **Automated Test Suite** in `tests/agent_eval/test_m1_graph.py`: 9 comprehensive test cases verifying PFZ, SAFETY, CONDITIONS, and UNSUPPORTED flows.
  - **Test Verification**: 24/24 passing tests in 0.51s across the repository.

---

### M2 — Integration Contracts, Tool Interfaces & Orchestration Hardening (COMPLETE)
- **Delivered**:
  - **Contract Definitions** in `backend/app/agents/integrations/contracts.py`:
    * `ToolOwner` enum (`DEV2`, `DEV3`, `DEV4`).
    * `ToolErrorCode` enum with semantic properties (`is_retryable`, `requires_clarification`, `is_user_safe`).
    * `ToolInvocationContext` typed schema.
    * `CAPABILITIES_CATALOG` capability taxonomy.
  - **Interface Protocols & Schemas**:
    * Dev 2 (`backend/app/agents/integrations/dev2.py`): `MarineConditionsPayload`, `WeatherConditionsPayload`, `HazardBulletinPayload`, `PFZSourceDataPayload`, and typed `@runtime_checkable` protocols.
    * Dev 4 (`backend/app/agents/integrations/dev4.py`): `RiskAssessmentPayload`, `PFZRankingPayload`, `RouteExposurePayload`, `GeospatialHazardPayload`, and typed protocols.
  - **Tool Adapters** in `backend/app/agents/integrations/adapters.py`:
    * `ProviderToolAdapter` normalizing external provider outputs into `ToolResult`.
    * Standardized `EvidenceItem` generation with provenance quality flags.
  - **M2 Contract Mocks** in `backend/app/agents/integrations/mocks.py`:
    * `MockMarineConditionsProvider`, `MockWeatherProvider`, `MockHazardProvider`, `MockPFZSourceProvider`.
    * `MockRiskEngine`, `MockPFZRankingEngine`, `MockRouteExposureEngine`, `MockGeospatialHazardEngine`.
    * Stamped with `["M2_CONTRACT_MOCK", "SIMULATED"]`.
    * Registration helper `register_m2_contract_mocks()`.
  - **Hardened Tool Registry & Graph**:
    * Capability availability discovery and toggling (`is_capability_available`, `get_unavailable_capabilities`).
    * Input context field validation (`required_context_fields`).
    * Supervisor dependency ordering (`marine_conditions` -> `weather_conditions` -> `hazard_search` -> `risk_evaluation`).
    * `run_orca_graph(..., tool_mode="contract_mock")` support.
    * Safe failure handling when capabilities are unavailable (`RecommendationStatus.UNKNOWN`).
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m2_integration.py` (17 tests covering ownership, capabilities, adapters, mocks, errors, dependency ordering, telemetry).
    * Total test count: 41/41 passing in 0.65s.
  - **Documentation & Handoff Guides**:
    * `docs/DEV2_DEV4_INTEGRATION_CONTRACT.md`: Master integration contract.
    * `docs/DEV2_IMPLEMENTATION_GUIDE.md`: Step-by-step connector implementation guide.
    * `docs/DEV4_IMPLEMENTATION_GUIDE.md`: Step-by-step risk/PFZ/route engine implementation guide.
    * `docs/M2_TOOL_INTEGRATION.md`: Milestone M2 architecture summary.

---

### M3 — LLM Provider Integration & LLM-Assisted Agent Orchestration (COMPLETE)
- **Delivered**:
  - **Provider-Agnostic LLM Interface** in `backend/app/agents/llm.py`:
    * Abstract base class `LLMProvider` requiring `generate()` and `generate_structured()`.
    * `FakeLLMProvider` for deterministic, zero-cost, 100% offline testing with fault simulation (`simulate_timeout`, `simulate_failure`, `simulate_malformed`).
    * `OllamaLLMProvider` for free local open-weights inference (e.g. Llama 3) via HTTP (`httpx`).
    * `OpenAILLMProvider` for OpenAI-compatible HTTP endpoints.
    * Factory function `get_llm_provider()` with environment-driven fallback.
  - **Prompt Injection Defense & Security** in `backend/app/agents/security.py`:
    * `PromptInjectionGuard`: Regex pattern detection for jailbreak and instruction overrides.
    * Input sandboxing: Wraps user prompts in `<user_input>` XML tags and strips delimiter injection.
    * Response safety auditing: Scans generated text to ensure models never claim safe voyage when deterministic status is `NO_GO` or `CAUTION`.
  - **Structured Cognitive Models** in `backend/app/agents/intent.py`:
    * `LLMTaskPlanProposal`: Structured tool scheduling with `planning_rationale` (strictly no chain-of-thought).
    * `LLMClarificationProposal`: Structured clarification request with missing fields and suggested quick chips.
    * `LLMResponseDraft`: Grounded multilingual synthesis draft.
  - **Prompt Management** in `backend/app/prompts/`:
    * `load_prompt()` loader with LRU caching in `backend/app/prompts/__init__.py`.
    * Production prompt templates: `intent.md`, `supervisor.md`, `response.md`, `clarification.md`.
  - **Graph Node Upgrades** in `backend/app/agents/graph.py`:
    * `intent_locale_node`: LLM extraction with sandboxed input and seamless fallback to deterministic classifier.
    * `supervisor_node`: LLM task plan validation against tool registry capabilities and strict dependency ordering.
    * `response_composer_node`: LLM multilingual drafting with safety invariance enforcement and trace telemetry logging.
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m3_llm.py` (24 test cases covering interface contracts, fake provider, injection defense, planning, safety invariance, evidence grounding, fallback paths, trace telemetry, and backward compatibility).
    * Total test count: 65/65 passing in 0.76s across the entire repository.
    * Linting: 0 ruff errors.
  - **Documentation**:
    * `docs/M3_LLM_INTEGRATION.md`: Architecture overview and verification summary.
    * `docs/LLM_PROVIDER_GUIDE.md`: Developer guide for configuring and deploying local Ollama or cloud providers.

---

### M4 — Multi-Turn Memory & State Persistence (COMPLETE)
- **Delivered**:
  - **ThreadContext Model** in `backend/app/agents/memory.py`:
    * Typed Pydantic context representation with `schema_version=1`.
    * Categorized state: Safe-to-carry attributes (`active_harbor`, `active_craft_profile`, `preferred_language`), temporal window (`time_window`), and conversational metadata.
  - **Persistence Abstraction (ConversationStore)**:
    * Abstract interface: `get_thread`, `save_thread`, `update_thread`, `delete_thread`, `exists`.
    * `InMemoryConversationStore`: Thread-safe, copy-on-read/write JSON storage for offline development, demonstrations, and automated testing.
    * `PostgreSQLConversationStore`: Contract adapter for Dev 2 PostgreSQL storage (`conversation_threads` table) with mock fallback.
    * `RedisConversationStore`: Contract adapter for Redis session caching with configurable TTL and mock fallback.
  - **Selective Carry-Forward Policy (MemoryManager)**:
    * Category A (Safe): Carries forward harbor, craft profile, language across turns.
    * Category B (Temporal): Validates relative departure times and expires conflicting windows.
    * Category C (Ephemeral): Drops raw prompts, model scratchpads, and execution errors.
    * Category D (Domain): Refuses to freeze old risk assessments or wave heights; guarantees fresh tool execution.
    * Deterministic user overrides: Explicit updates (e.g. changing harbor to Goa) unconditionally replace prior context.
    * Privacy & data minimization: `sanitize_context_data()` scrubs passwords, tokens, API keys, and internal scratchpads before saving.
  - **LangGraph Integration** in `backend/app/agents/graph.py`:
    * Multi-turn context loading, selective merge, and persistence across `run_orca_graph()` calls.
    * Trace telemetry logs memory events (`carried_fields`, `overwritten_fields`, turn counter).
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m4_memory.py` (23 test cases covering CRUD, thread isolation, selective carry-forward, overrides, missing fields, temporal expiry, privacy scrubbing, domain freshness, store fallback, PostgreSQL/Redis contracts, 2-turn & 3-turn E2E flows).
    * Total repository test count: **88/88 passing** in 0.82s.
    * Linting: 0 ruff errors.
  - **Documentation**:
    * `docs/M4_MEMORY_ARCHITECTURE.md`: Complete architectural guide and test verification matrix.
    * `docs/MEMORY_PROVIDER_GUIDE.md`: Developer guide for configuring ConversationStore backends.

---

### M5 — Safety Reasoning Flow (COMPLETE)
- **Delivered**:
  - **Authoritative Safety Orchestration**:
    * Clean separation of concerns: Dev 4 `RiskEvaluationEngine` holds single source of truth for safety determinations (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`). Dev 3 manages orchestrations, validations, and explanations.
    * Strict DAG dependency ordering enforced by supervisor: `marine_conditions` + `weather_conditions` + `hazard_search` -> `risk_evaluation`.
  - **Conservative Upstream Failure Handling**:
    * If critical upstream observations (`marine_conditions` or `weather_conditions`) fail or time out, `risk_evaluation` is aborted and safely yields `RecommendationStatus.UNKNOWN`, low confidence, and no fabricated values.
    * If `risk_evaluation` fails or raises an unhandled exception, state defaults gracefully to `UNKNOWN` with actionable warning to hold departure.
  - **Safety Invariance Guardrail**:
    * Enforces `ResponseComposer.validate_safety_invariance()` across all safety queries to prevent LLMs or templates from modifying authoritative status.
    * `PromptInjectionGuard.audit_response_for_tampering()` blocks model drafts that declare safe voyage under `NO_GO`, `CAUTION`, or `UNKNOWN`.
  - **Multilingual Grounded Response Synthesis**:
    * Deterministic, evidence-backed English, Marathi, and Hindi templates anchored on immutable `[<STATUS>]` operational header.
    * Mentions departure harbor and decisive factors clearly.
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m5_safety.py` (16 test cases covering basic safety flow, GO/CAUTION/NO_GO/UNKNOWN status handling, invariance guardrails, dependency order, upstream/downstream failures, multi-turn fresh evaluation, context carry-forward, explicit overrides, evidence grounding, multilingual advisories, and architectural isolation).
    * Total repository test count: **116/116 passing** in 1.70s.
    * Linting: 0 ruff errors.
  - **Documentation**:
    * `docs/M5_SAFETY_REASONING.md`: Complete architectural guide and test verification matrix.

---

### M6 — Hazard & Geofence Flow (COMPLETE)
- **Delivered**:
  - **M6.2 — Geofence Tool Selection**:
    * Integrated Dev 4 `geospatial_hazard` capability into `ToolRegistry` and `CAPABILITIES_CATALOG`.
    * Implemented `ProviderToolAdapter.adapt_geospatial_hazard()` producing normalized `ToolResult` with `geofence_intersection` and `distance_to_boundary_km` evidence citations.
    * Extended `MockGeospatialHazardEngine` double supporting `hard_stop`, `restricted`, `intersected`, and failure simulation.
  - **M6.3 — Route Context Resolution**:
    * Resolved origin and destination from explicit prompt expressions (priority 1), `ThreadContext` via M4 `MemoryManager` (priority 2), or `clarification_node` (priority 3).
    * Guaranteed zero fabrication: Never invents destinations or falls back to Ratnagiri for route-dependent inquiries.
    * Handled explicit route corrections overriding remembered context.
  - **M6.4 — Route Hazard Orchestration**:
    * Supervisor dynamically schedules required specialist capabilities (`hazard_search`, `geospatial_hazard`, `route_analysis`, `marine_conditions`) under strict DAG dependency ordering.
    * Passes typed `origin_harbor` and `destination` into specialist contexts.
  - **M6.5 — Combined Hazard + Geofence Reasoning**:
    * Combines weather bulletins, geofenced boundaries, and route exposures into coherent mariner advisories.
    * Preserves successful results on partial dependency failures while reporting missing verifications conservatively (`UNKNOWN`).
  - **M6.6 — Hard-Stop / Restricted-Zone Enforcement**:
    * Authoritative status mapping: `hard_stop=True` or `cyclone_warning_active=True` $\rightarrow$ `NO_GO`; `restricted=True`, `intersected=True`, or `squall_alert=True` $\rightarrow$ `CAUTION`.
    * Strict invariance: `PromptInjectionGuard` and `ResponseComposer.validate_safety_invariance()` prevent softening phrases.
  - **M6.7 — Evidence + Response Explanation**:
    * `EvidenceValidator` audits dynamic critical metrics (`cyclone_warning_active`, `geofence_intersection`, `recommended_route_id`).
    * Clear grounding without hallucinating provenance.
  - **M6.8 — Multilingual Support & Hardening**:
    * Localized advisories in English, Hindi (`hi`), and Marathi (`mr`) with invariant `[<STATUS>]` headers.
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m6_hazards.py` (28 test cases covering all M6 requirements).
    * Total repository test count: **144/144 passing** in 1.74s.
    * Linting: 0 ruff errors across all agent packages and test suites.
  - **Documentation**:
    * `docs/M6_HAZARD_GEOFENCE.md`: Comprehensive guide to M6 architecture, workflows, contracts, and test matrix.

### M7 — Route Reasoning Flow (COMPLETE)
- **Delivered**:
  - **M7.1 — Contract-Accurate Capability Plan**:
    * Audited all existing `CAPABILITIES_CATALOG` entries, `ToolDefinition` declarations, and `_enforce_dependency_order()` ranks — zero contract modifications needed.
    * Split `ROUTE` intent out of the combined `HAZARDS/ROUTE` supervisor branch into its own deterministic plan.
    * ROUTE plan: `marine_conditions(10) → weather_conditions(20) → hazard_search(30) → geospatial_hazard(35) → route_analysis(60) → risk_evaluation(80)`.
    * Satisfies all declared dependency chains: `route_analysis → [marine_conditions, hazard_search]`; `risk_evaluation → [marine_conditions, weather_conditions, hazard_search]`.
    * HAZARDS branch restored with M6 `has_route` logic for queries like "cyclone risks on my route from X to Y".
  - **M7.2 — Route Candidate Preservation**:
    * `specialist_tools_node` now extracts `routes` list from `RouteExposurePayload` after successful `route_analysis` execution.
    * Writes full candidate list to `state["route_candidates"]` (declared `ORCAState` field).
    * `_compare_route_candidates()` helper reads only Dev 4 output fields (`recommended_route_id`, `risk_rating`, `exposure_score`) — no new formulas or thresholds.
    * Comparison summary stored in `observations["route_comparison"]` for response composer.
  - **M7.3 — Dedicated Route Response Template**:
    * `response_composer_node` now has a dedicated `ROUTE` branch separate from `HAZARDS`.
    * Lists both candidate routes with Dev 4's `risk_rating`, `exposure_score`, `distance_km`, `max_wave_height_m`.
    * Marks Dev 4 recommended route with ✓ `[RECOMMENDED by Dev 4]`.
    * Authoritative `[STATUS]` header from `risk_evaluation` as single source of truth.
    * Fallback to hazard/geofence signals only when `risk_evaluation` fails or yields `UNKNOWN`.
  - **M7.4 — Multilingual Route Advisories**:
    * English: `[STATUS] Route Safety Comparison (from X to Y):`
    * Hindi: `[STATUS] मार्ग सुरक्षा तुलना (X से Y):`
    * Marathi: `[STATUS] मार्ग सुरक्षा तुलना (X ते Y):`
    * Route risk ratings localized: LOW → कम खतरा/कमी धोका, MODERATE → मध्यम खतरा/मध्यम धोका, HIGH → उच्च खतरा/जास्त धोका.
  - **M7.5 — Safety Invariants Preserved**:
    * `NO_GO` and `CAUTION` from authoritative engines are never softened.
    * Conservative failure semantics reused from M5/M6.
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m7_route.py` (45 test cases covering all M7 requirements).
    * Total repository test count: **189/189 passing** in 2.32s.
    * Zero regressions in M0–M6 test suites.
  - **Documentation**:
    * `docs/M7_ROUTE_REASONING.md`: Full architectural guide covering capability plan, dependency contracts, candidate comparison, response templates, safety invariants, and test matrix.

---

### M8 — Intent Switching Across Multi-Turn Conversations (COMPLETE)
- **Delivered**:
  - **M8.1 — Dynamic Intent Transition Detection**:
    * `intent_locale_node` evaluates `current_intent` from prior turn (via `ThreadContext.last_intent`) and the incoming message together, enabling clean SAFETY → HAZARDS → ROUTE → PFZ hops without ambiguity.
    * Intent resolution follows strict priority: explicit current-turn signals override carry-forward.
  - **M8.2 — Selective Context Carry-Forward on Intent Switch**:
    * On intent change, `MemoryManager` carries forward operationally stable fields: `active_harbor`, `destination`, `active_craft_profile`, `time_window`.
    * Volatile turn-specific fields (`tool_results`, `evidence_items`, `observations`, `risk_status`) are cleared so stale data never bleeds across intents.
  - **M8.3 — Fresh Tool Dispatch Per Intent**:
    * Supervisor generates a fresh capability plan matching the new intent's requirements each turn.
    * Dependency DAG is re-evaluated; no cached tool results from prior intents are reused.
  - **M8.4 — Thread Isolation**:
    * Each `thread_id` maintains independent `ThreadContext`; concurrent sessions never share state.
    * `ConversationStore` (InMemory / PostgreSQL / Redis) guarantees per-thread isolation.
  - **M8.5 — Clarification on Missing Context After Switch**:
    * If required parameters (e.g., origin for a ROUTE query) are absent after an intent hop and not inferable from carry-forward context, `clarification_node` responds immediately without tool dispatch.
  - **Comprehensive Test Suite**:
    * `tests/agent_eval/test_m8_intent_switching.py` (15 test cases covering SAFETY↔HAZARDS, HAZARDS↔ROUTE, ROUTE↔PFZ, and multi-hop chains).
    * Total repository test count: **204/204 passing** in 2.41s.
    * Zero regressions in M0–M7 test suites.
  - **Documentation**:
    * M8 behaviour is documented under the intent-switching section of `docs/M4_MEMORY_ARCHITECTURE.md` and `docs/AGENT_WORKFLOW.md`.

---

### M9 — Multilingual / Local-Language Pipeline (COMPLETE)
- **Delivered**:
  - **M9.1 — Deterministic Language Detection** (`backend/app/agents/localization.py`):
    * Devanagari Unicode block scoring (`\u0900–\u097F`) with per-language distinctive token lexicons (Marathi: `आहे`, `मासेमारी`, `होडी`, `लाटा`; Hindi: `क्या`, `है`, `मछली`, `तूफान`).
    * Romanized transliteration parser for common coastal Hinglish/Marathish tokens (`masemari`, `hodi`, `udya`, `toofan`, `sakali`).
    * Contextual carry-forward: short continuation queries inherit `preferred_language` from `ThreadContext` avoiding incorrect language flips.
    * Safe fallback: unrecognized scripts default to `en` without pipeline degradation.
  - **M9.2 — Bounded Maritime Glossary Normalization**:
    * `HARBOR_GLOSSARY`: Marathi/Hindi harbor name variants → canonical English strings (`रत्नागिरी` → `Ratnagiri`, `मुंबई` → `Mumbai`).
    * `CRAFT_GLOSSARY`: Vessel-type variants → canonical tokens (`होडी` → `motorized_boat`, `nao` → `traditional_vessel`).
    * `TEMPORAL_GLOSSARY`: Temporal markers → canonical values (`उद्या` / `kal` → `tomorrow`, `sakali` → `morning`).
    * Explicitly rejects open-ended dialect hallucination; only defined glossary terms are normalized.
  - **M9.3 — LLM-Assisted Multilingual Structured Understanding**:
    * `intent_locale_node` optionally invokes `LLMProvider` with `multilingual_understanding.md` prompt to extract `IntentExtractionResult` JSON from Marathi/Hindi queries.
    * `canonicalize_extracted_entities()` passes LLM-extracted harbor/craft/temporal values through deterministic glossaries before downstream DAG.
    * Graceful fallback: malformed or timed-out LLM responses trigger immediate deterministic regex/glossary extraction without pipeline interruption.
  - **M9.4 — LLM Multilingual Response Generation**:
    * `response_composer_node` passes authoritative risk status, decisive factors, and verified evidence to `LLMProvider` with `multilingual_response.md` prompt.
    * LLM synthesizes natural, empathetic advisories in the mariner's detected language (`en`, `hi`, `mr`).
    * `ResponseComposer.validate_safety_invariance()` and `PromptInjectionGuard.audit_response_for_tampering()` audit every LLM draft — multilingual unauthorized safe assertions (`जाणे सुरक्षित आहे`, `जाना सुरक्षित है`) are detected and blocked.
    * Canonical `[STATUS]` invariant header is always prepended regardless of LLM output.
  - **M9.5 — Multi-Turn Language Switching & Persistence**:
    * `preferred_language` maintained in `ThreadContext`; updated each turn on language detection.
    * Switching language never clears operational attributes (`active_harbor`, `destination`, `active_craft_profile`, `time_window`).
    * Clarification responses are issued in the mariner's currently detected language.
  - **M9.6 — 100% Offline FakeLLMProvider Support**:
    * `FakeLLMProvider` extended with `callable` canned response support and `LLMResponseDraft` fallbacks.
    * All 35 multilingual test cases execute fully offline without external API keys.
  - **Comprehensive Test Suite** (`tests/agent_eval/test_m9_multilingual.py`):
    * 35 test cases covering language detection, glossary normalization, E2E multilingual flows (EN/HI/MR), multi-turn switching, clarification in detected language, safety/status invariance, LLM NLU extraction, LLM response generation, tampering rejection, and offline FakeLLMProvider validation.
    * Total repository test count: **239/239 passing** in 2.37s.
    * Linting: **0 ruff errors**.
  - **Documentation**:
    * `docs/M9_MULTILINGUAL_PIPELINE.md`: Full architecture guide covering all 6 pillars, pipeline diagram, language detection algorithm, glossary design, LLM NLU/response nodes, multi-turn persistence, dialect strategy/limitations, and complete 35-test verification matrix.

---

### M10 — Evidence Validation & Hallucination Prevention (COMPLETE)
- **Delivered**:
  - **M10.1 — Evidence Provenance Propagation**:
    * Propagated `evidence_id: Optional[str]` across `EvidenceItem`, `EvidenceRecord`, and `ToolResult`.
    * `specialist_tools_node` guarantees deterministic `evidence_id` assignment for all observations.
    * `evidence_validator_node` and `response_composer_node` preserve machine-verifiable evidence chains across LangGraph executions.
  - **M10.2 — Multilingual Numerical Claim Extraction**:
    * `EvidenceValidator.extract_numerical_claims(text)` extracts numerical statements across English, Hindi, and Marathi.
    * Parses units for wave height (`m`), wind speed (`km/h`), visibility (`km`), rainfall (`mm`), sea temperature (`°C`), water depth (`m`), distance (`km`), heading (`°`), route exposure score, hazard proximity (`km`), and swell period (`s`).
    * Supports Devanagari numerals (`०-९`) and Marathi/Hindi metric unit expressions.
  - **M10.3 — Claim-to-Evidence Mapping & Validation**:
    * `EvidenceValidator.validate_claim(...)` binds nearest citation tag (`[EV123]`) and compares extracted numerical values against cited `EvidenceItem` data points within permissible tolerances.
    * Detects uncited claims (`MISSING_CITATION`), non-existent citations (`INVALID_CITATION_ID`), metric mismatches (`UNRELATED_EVIDENCE`), value hallucinations (`VALUE_MISMATCH`), and stale evidence (`STALE_EVIDENCE`).
  - **M10.4 — Stale, Conflicting & Missing Evidence Handling**:
    * `EvidenceValidator.is_evidence_stale(item)` invalidates expired evidence records based on timestamp thresholds without inventing new domain calculations.
    * `EvidenceValidator.detect_conflicts(evidence_items)` detects contradictory sensor inputs for the same metric, suppressing single-value assertions and flagging explicit uncertainty.
    * Numerical values without valid `EvidenceItem` records are blocked from authoritative presentation.
  - **M10.5 — Selective Unsupported Claim Suppression**:
    * `EvidenceValidator.suppress_unsupported_claims(text, report)` prunes ungrounded clauses at clause/sentence boundaries while preserving grounded claims and citations.
    * Fallback to deterministic template composer if text is corrupted or ungrounded.
  - **M10.6 — Safety Invariance Preserved (M5 Guard)**:
    * Evidence validation functions strictly as a factual grounding filter; it cannot override or upgrade authoritative risk statuses (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`).
    * Full prompt injection and tampering defenses remain active.
  - **M10.7 — 100% Offline Testing**:
    * Verified with `FakeLLMProvider` simulating hallucinated numerical facts and unauthorized citations.
  - **Comprehensive Test Suite** (`tests/agent_eval/test_m10_evidence.py`):
    * 26 test cases covering evidence ID survival, valid claim acceptance, uncited claim rejection, wind speed suppression, missing/invalid evidence IDs, stale evidence expiry, conflict detection, partial evidence support, discrete multi-claim mapping, LLM hallucination prevention, safety invariance (GO/CAUTION/NO_GO/UNKNOWN), multilingual grounding (EN/HI/MR), and M5–M9 compatibility.
    * Total repository test count: **265/265 passing** in 2.28s.
    * Linting: **0 ruff errors**.
  - **Documentation**:
    * `docs/M10_EVIDENCE_VALIDATION.md`: Master M10 architecture guide covering lifecycle, graph propagation, claim mapping, edge cases, suppression mechanisms, and verification matrix.

---

### M11 — Response Composer & Operational Presentation (COMPLETE)
- **Delivered**:
  - **M11.1 — Complete 10 Core Requirements Implementation**:
    1. *Recommendation Status*: Immutable `RecommendationStatus` (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`, `INFORMATIONAL`) prepended as `[<STATUS>]` header.
    2. *Concise Summary*: Executive 1-2 sentence recommendation summary.
    3. *Decisive Factors*: Bulleted key environmental and numerical drivers with citation references.
    4. *Suggested Next Action*: Direct, actionable directive for vessel operators.
    5. *Confidence Explanation*: Multilingual confidence rating (`HIGH`, `MEDIUM`, `LOW`) and justifications formatted via `ResponseComposer.format_confidence_explanation()`.
    6. *Evidence References*: Verifiable `EvidenceItem` citations with `evidence_id` identifiers attached to `ChatResponse.evidence` and cited in response text.
    7. *Operational Warnings*: Surfaced caveats, degraded service warnings, and conflict flags.
    8. *Contextual Suggested Follow-ups*: Intelligent quick replies generated via `ResponseComposer.generate_suggested_followups()` across intents, statuses, and languages.
    9. *Same-Language Output*: End-to-end localized synthesis in English (`en`), Marathi (`mr`), Hindi (`hi`), and Tamil (`ta`).
    10. *Concise Operational Template*: Structured, scannable markdown format avoiding conversational clutter.
  - **M11.2 — Invariant Enforcement**:
    * Preserved Dev 4 risk evaluation immutability with `ResponseComposer.validate_safety_invariance()`.
    * Maintained M10 numerical evidence grounding and hallucination filtering.
    * Maintained M9 language selection without bleed.
    * Maintained M4/M8 multi-turn context carry-forward without fabricating facts.
  - **M11.3 — Comprehensive Test Suite** (`tests/agent_eval/test_m11_response_composer.py`):
    * 16 dedicated test cases covering all 10 M11 requirements, safety invariance, evidence grounding, and multi-turn multilingual E2E flows.
    * Total repository test count: **281/281 passing** in 2.45s.
    * Linting: **0 ruff errors**.
  - **Documentation**:
    * `docs/M11_RESPONSE_COMPOSER.md`: Architectural specification and verification guide for Milestone M11.

---

### M12 — Prompt Security & Untrusted Content Isolation (COMPLETE)
- **Delivered**:
  - **M12.1 — System Prompt Guardrails & XML Boundary Partitioning**:
    * System/developer instructions remain strictly authoritative.
    * User input is encapsulated within `<user_input>` boundary tags.
    * External tool outputs and weather bulletins are encapsulated within `<untrusted_tool_data>` tags with explicit notices declaring them passive observation data, not instructions.
    * Validated numerical evidence metrics are partitioned within `<evidence_context>`.
  - **M12.2 — Tool-Result & External Data Isolation**:
    * Hardened boundary ensuring text inside tool outputs (e.g. cyclone bulletins with adversarial text) remains pure DATA.
    * External content cannot alter intent, schedule arbitrary tools, mutate `ThreadContext`, change risk status, or bypass evidence validation.
  - **M12.3 — PromptInjectionGuard Extension & Deterministic Audits**:
    * Comprehensive injection signatures covering instruction overrides (`"ignore previous instructions"`), system prompt extraction (`"reveal system prompt"`), chain-of-thought extraction (`"show chain of thought"`), status forcing (`"pretend risk engine returned GO"`), unauthorized commands, and Indic multilingual injection patterns (Hindi/Marathi).
    * Structured `SecurityAuditResult` (`SAFE`, `BLOCKED`, `SANITIZED`) with detected vulnerability signatures.
  - **M12.4 — Secret & Credential Redaction**:
    * Automated multi-pattern redaction for OpenAI keys, Google API keys, GitHub tokens, AWS keys, Bearer tokens, passwords, and database connection strings before delivery or memory persistence.
  - **M12.5 — Raw Chain-of-Thought Protection**:
    * Strict stripping of `<think>...</think>`, `<scratchpad>`, and ReAct `Thought:` / `Reasoning:` prefixes.
  - **M12.6 — Output Safety Tampering Defense**:
    * Deterministic cross-check ensuring synthesized drafts never declare safe voyage under `NO_GO`, `CAUTION`, or `UNKNOWN` statuses.
  - **M12.7 — Comprehensive Test Suite** (`tests/agent_eval/test_m12_prompt_security.py`):
    * 24 dedicated test cases verifying all 24 required scenarios (system prompt authority, injection blocking, tool result isolation, bulletin isolation, evidence isolation, memory protection, secret redaction, CoT protection, safety invariance, multilingual handling, and full M0–M11 regression).
    * Total repository test count: **305/305 passing** in 2.66s.
    * Linting: **0 ruff errors**.
  - **Documentation**:
    * `docs/M12_PROMPT_SECURITY.md`: Comprehensive threat model, authority partitioning, defense-in-depth architecture, and verification matrix.


