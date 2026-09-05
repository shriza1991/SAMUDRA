# Milestone M3: LLM Provider Integration & LLM-Assisted Agent Orchestration

**Owner**: Dev 3 (Agent Orchestration & Explainability)  
**SIH Problem Statement**: PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
**Status**: COMPLETE  
**Milestone**: M3  

---

## 1. Executive Summary

Milestone M3 evolves the SAMUDRA / ORCA agent architecture from a purely template/deterministic system (M1/M2) into an **LLM-assisted cognitive orchestration pipeline**. 

Crucially, M3 introduces this cognitive intelligence while strictly preserving every deterministic domain boundary, safety invariant, evidence gate, and contract interface established in M0, M1, and M2:
1. **Zero Chain-of-Thought Leakage**: Schema fields and internal prompts explicitly ban private scratchpads or chain-of-thought dumps (`planning_rationale` is constrained to a single decision sentence).
2. **Deterministic Safety Invariance**: The LLM acts solely as an explainer and summarizer. It can **never** soften, contradict, or override Dev 4 risk recommendations (`NO_GO`, `CAUTION`, `GO`, `UNKNOWN`). A two-tier audit gate enforces this unconditionally.
3. **Prompt Injection & Adversarial Defense**: The `PromptInjectionGuard` inspects all inbound queries against known injection and jailbreak signatures, wraps prompts in `<user_input>` XML sandboxes, and verifies model drafts before user delivery.
4. **Transparent Graceful Fallback**: If an LLM provider is unconfigured, times out, throws a network exception, or returns malformed JSON, the pipeline immediately falls back to M1/M2 deterministic rules without crashing or degrading safety.
5. **Provider Agnostic & Zero Mandatory Paid Services**: Works 100% offline out-of-the-box via `FakeLLMProvider` for CI/CD and evaluation, and natively supports local open-weights Ollama (e.g. Llama 3) and OpenAI-compatible endpoints via `httpx`.

---

## 2. Architecture & Information Flow

The updated LangGraph cognitive pipeline in M3 follows this sequential flow:

```
                  User Query
                      │
                      ▼
         ┌─────────────────────────┐
         │  PromptInjectionGuard   │ ──(Malicious Pattern)──► Block & Return Safe Advisory
         │  & XML Input Sandboxing │
         └────────────┬────────────┘
                      │ Clean & Sandboxed Input
                      ▼
         ┌─────────────────────────┐
         │   intent_locale_node    │
         │  (LLM-Assisted with     │
         │   Deterministic Fallback│
         └────────────┬────────────┘
                      │ Validated IntentCategory + ISO Locale + ExtractedEntities
                      ▼
         ┌─────────────────────────┐
         │     supervisor_node     │
         │  (LLM TaskPlan Proposal │
         │   + Dependency Ordering │
         │   + Capability Check)   │
         └────────────┬────────────┘
                      │ Bounded Task Plan (Observations BEFORE Analytics)
                      ▼
         ┌─────────────────────────┐
         │  specialist_tools_node  │ ◄── Dispatches to Dev 2 Connectors & Dev 4 Engines
         │  (AgentToolRegistry)    │     (M1 Demos or M2 Contract Mocks)
         └────────────┬────────────┘
                      │ Tool Results + Domain Observations + Evidence Records
                      ▼
         ┌─────────────────────────┐
         │ evidence_validator_node │ ──(Missing Critical Citation)──► Appends Cautionary Warning
         │ (Citation Coverage Gate)│
         └────────────┬────────────┘
                      │ Audited Evidence Items + Immutable Dev 4 Risk Assessment
                      ▼
         ┌─────────────────────────┐
         │ response_composer_node  │ ◄── LLM Drafts Multilingual Synthesized Response
         │ (LLM Synthesis)         │
         └────────────┬────────────┘
                      │
                      ▼
         ┌─────────────────────────┐
         │  Safety Invariance Gate │
         │  - audit_response_for_  │ ──(Tampering Detected)──► Fallback to Deterministic Template
         │    tampering()          │
         │  - validate_safety_     │
         │    invariance()         │
         └────────────┬────────────┘
                      │ Immutable RecommendationStatus Maintained
                      ▼
         ┌─────────────────────────┐
         │      terminal_node      │
         └────────────┬────────────┘
                      │ Sanitized Trace Sealed (Tokens & Latency Tracked, Zero CoT)
                      ▼
                 ChatResponse
```

---

## 3. Core Components Implemented

### 3.1 LLM Provider Abstraction (`backend/app/agents/llm.py`)
- **`LLMProvider` (ABC)**: Clean contract requiring `generate()` (unstructured completion) and `generate_structured()` (Pydantic schema validation).
- **`FakeLLMProvider`**: Deterministic test double supporting pre-programmed canned text, canned Pydantic models, call telemetry, and configurable failure simulators (`simulate_timeout=True`, `simulate_failure=True`, `simulate_malformed=True`).
- **`OllamaLLMProvider`**: Local, zero-cost HTTP inference client connecting to Ollama REST API (`/api/chat`) using `httpx`.
- **`OpenAILLMProvider`**: Standard OpenAI-compatible HTTP client for cloud or self-hosted vLLM/TGI deployments.
- **`get_llm_provider()`**: Configuration-driven factory returning the active provider based on environment settings.

### 3.2 Security & Injection Defense (`backend/app/agents/security.py`)
- **Adversarial Pattern Detection**: Regex-based detection of instruction override attempts, jailbreak phrases, role-play bypasses, and unauthorized prompt extraction.
- **XML Tag Sandboxing**: Encloses queries in `<user_input>` while stripping nested tag injection.
- **Response Tampering Audit**: Scans generated response text to guarantee models do not claim a voyage is "safe" or "unrestricted" when the authoritative deterministic state is `NO_GO` or `CAUTION`.

### 3.3 Structured Cognitive Schemas (`backend/app/agents/intent.py`)
- **`LLMTaskPlanProposal`**: LLM-suggested list of tool capabilities with a 1-sentence `planning_rationale`. Explicitly excludes any `reasoning` field to enforce zero chain-of-thought leakage.
- **`LLMClarificationProposal`**: Formulates polite localized questions and suggested response chips when operational parameters (e.g. `origin_harbor`) are missing.
- **`LLMResponseDraft`**: Structured draft enforcing `synthesized_text`, `key_factors_cited`, and output `language`.

### 3.4 Bounded Orchestration Integration (`backend/app/agents/graph.py`)
- Updated `intent_locale_node`: Injects XML-sandboxed queries into `intent.md` prompt, maps LLM output to strictly validated `IntentCategory` enums, and safely falls back on failure.
- Updated `supervisor_node`: Validates LLM-proposed tool capabilities against `tool_registry.list_capabilities()`, drops unknown or unavailable capabilities, and enforces deterministic dependency ordering (`_enforce_dependency_order`: raw observations must run before downstream analytics/risk engines).
- Updated `response_composer_node`: Grounds LLM draft in verified tool observations, audits draft for safety status tampering, runs `ResponseComposer.validate_safety_invariance()`, and records token/latency telemetry in sanitized audit trace.
- Enhanced `run_orca_graph`: Accepts `llm_provider: Optional[LLMProvider] = None` and `llm_mode: str = "auto" | "fake" | "deterministic"`.

---

## 4. Test Verification Summary

The M3 milestone verification was executed against the SAMUDRA test suite:
- Total Test Cases: **65 passing** (100% pass rate).
- M3-Specific Test Cases: **24 passing** in `tests/agent_eval/test_m3_llm.py`.
- Regression Check: All M0, M1, and M2 contract and integration tests remain 100% green.
- Linting: 0 errors under `ruff check`.

| Test Category | Test Case | Status |
| :--- | :--- | :--- |
| **Provider Contracts** | `test_llm_provider_abstract_interface` | PASSED |
| **Fake Provider** | `test_fake_llm_provider_generate_text` | PASSED |
| **Structured Output** | `test_fake_llm_provider_generate_structured` | PASSED |
| **Factory Routing** | `test_llm_factory_selection` | PASSED |
| **Zero-CoT Schemas** | `test_llm_task_plan_proposal_no_cot_leakage` | PASSED |
| **Clarification Schema** | `test_llm_clarification_proposal` | PASSED |
| **Response Draft Schema** | `test_llm_response_draft_structure` | PASSED |
| **Injection Sandboxing** | `test_prompt_injection_guard_sanitization` | PASSED |
| **Injection Detection** | `test_prompt_injection_guard_detection` | PASSED |
| **Clean Queries Pass** | `test_prompt_injection_guard_legitimate_queries` | PASSED |
| **Tampering Audit** | `test_prompt_injection_response_tampering_audit` | PASSED |
| **Graph Injection Flow** | `test_graph_injection_interception_flow` | PASSED |
| **Multilingual Intent** | `test_llm_assisted_intent_and_locale_tamil` | PASSED |
| **Supervisor Planning** | `test_llm_supervisor_planning_with_registry_validation` | PASSED |
| **Hallucination Strip** | `test_llm_supervisor_filters_unavailable_capabilities` | PASSED |
| **Safety Invariance** | `test_safety_invariance_llm_cannot_override_caution` | PASSED |
| **Safety Invariance Direct** | `test_response_composer_safety_invariance_direct` | PASSED |
| **Evidence Grounding** | `test_evidence_grounding_in_llm_assisted_response` | PASSED |
| **Timeout Fallback** | `test_fallback_on_llm_timeout` | PASSED |
| **Exception Fallback** | `test_fallback_on_llm_exception` | PASSED |
| **Malformed JSON Fallback**| `test_fallback_on_llm_malformed_json` | PASSED |
| **Sanitized Telemetry** | `test_llm_telemetry_in_trace_without_raw_prompt_leakage` | PASSED |
| **M1 Compatibility** | `test_m1_demo_mode_backward_compatibility` | PASSED |
| **M2 Compatibility** | `test_m2_contract_mock_mode_backward_compatibility` | PASSED |
