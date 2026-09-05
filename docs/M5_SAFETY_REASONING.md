# Dev 3 Milestone M5 — Safety Reasoning Flow

> **Project:** SAMUDRA — Smart Autonomous Marine Understanding, Decision & Risk Assistant  
> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Milestone:** M5 — Safety Reasoning Flow  
> **Status:** **COMPLETE**  
> **Author:** Dev 3 (Agent Orchestration & Explainability)  

---

## 1. Executive Summary

Milestone **M5** implements the authoritative **Safety Reasoning Flow** within SAMUDRA's LangGraph agent architecture. When a mariner asks an operational safety inquiry such as:

> *"Can I go fishing tomorrow at 6 AM from Ratnagiri?"*

SAMUDRA deterministically coordinates environmental observations, invokes Dev 4 risk evaluation, strictly enforces safety invariance, audits factual citations, and synthesizes localized advisories (in English, Marathi, or Hindi) without permitting any LLM softening or deviation.

---

## 2. Core Architectural Principles

1. **Dev Boundary Invariance**:
   - **Dev 3 (Agent Orchestration)** only orchestrates inputs, execution order, validation, evidence citations, and user-facing presentation.
   - **Dev 4 (`RiskEvaluationEngine`)** is the sole authority for voyage recommendations (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`). Dev 3 *never* calculates domain risk thresholds, wave ceilings, or distance rankings.

2. **Strict DAG Dependency Ordering**:
   - Environmental specialist tools (`marine_conditions`, `weather_conditions`, `hazard_search`) must execute and succeed *prior* to `risk_evaluation`.
   - Supervisor ensures this topological order regardless of whether task planning is deterministic or LLM-assisted.

3. **Conservative Upstream Failure Handling**:
   - If any critical upstream provider (`marine_conditions` or `weather_conditions`) fails or times out, Dev 3 *aborts* `risk_evaluation` and resolves the advisory conservatively to:
     - `RecommendationStatus.UNKNOWN`
     - `ConfidenceLevel.LOW`
     - Clear directive: *"Hold departure until authoritative advisory is verified."*
     - No fabricated environmental values.

4. **Multi-Tier Safety Guardrails**:
   - `ResponseComposer.validate_safety_invariance()`: Raises an uncatchable `ValueError` if the composed chat response alters the authoritative recommendation status.
   - `PromptInjectionGuard.audit_response_for_tampering()`: Audits natural language drafts to prevent LLMs from declaring safe voyage or encouraging departure under `NO_GO`, `CAUTION`, or `UNKNOWN`.

---

## 3. End-to-End Safety Flow

```
                      USER QUERY
  ("Can I go fishing tomorrow at 6 AM from Ratnagiri?")
                          ↓
                 [intent_locale_node]
        - Intent: IntentCategory.SAFETY
        - Harbor: "Ratnagiri" (resolved from message / thread context)
        - Language: "en" / "mr" / "hi"
                          ↓
                  [supervisor_node]
        - Checks capability availability in AgentToolRegistry
        - Constructs dependency-ordered TaskPlan:
          1. marine_conditions (Dev 2)
          2. weather_conditions (Dev 2)
          3. hazard_search (Dev 2)
          4. risk_evaluation (Dev 4)
                          ↓
              [specialist_tools_node]
        - Dispatches tools via AgentToolRegistry
        - Captures observations & provenance evidence
        - Aborts to UNKNOWN if upstream dependencies fail
        - Populates authoritative Recommendation & Confidence
                          ↓
             [evidence_validator_node]
        - Verifies citations for critical metrics:
          "significant_wave_height", "risk_status"
        - Confirms quality flags (e.g. M2_CONTRACT_MOCK, OFFICIAL)
                          ↓
             [response_composer_node]
        - Synthesizes localized natural language advisory
        - Mandates invariant status header: [GO] / [CAUTION] / [NO_GO] / [UNKNOWN]
        - Enforces ResponseComposer.validate_safety_invariance()
                          ↓
                   [terminal_node]
        - Validates invariants, finalizes trace, seals output
                          ↓
                    FINAL RESPONSE
```

---

## 4. Multilingual Advisory Support

Advisories in Marathi and Hindi strictly preserve the authoritative English status header (`[GO]`, `[CAUTION]`, `[NO_GO]`, `[UNKNOWN]`) for operational compliance across ports, while presenting localized guidance:

- **English Header**: `[CAUTION] Operational Safety Advisory for Ratnagiri:`
- **Marathi Header**: `[CAUTION] Ratnagiri साठी सागरी सुरक्षा सल्ला:`
- **Hindi Header**: `[CAUTION] Ratnagiri के लिए समुद्री सुरक्षा सलाह:`

---

## 5. Verification Matrix (16/16 Tests Passing)

All tests reside in [`tests/agent_eval/test_m5_safety.py`](file:///c:/Users/dyara/SAMUDRA/tests/agent_eval/test_m5_safety.py):

| Test ID | Name | Scenario Verified | Status |
| :--- | :--- | :--- | :--- |
| **M5-01** | `test_m5_safety_basic_flow` | End-to-end traversal across all nodes for standard safety query | **PASSED** |
| **M5-02** | `test_m5_go_status` | Authoritative `GO` recommendation preservation & high confidence | **PASSED** |
| **M5-03** | `test_m5_caution_status` | Authoritative `CAUTION` recommendation with 5 nm restricted zone | **PASSED** |
| **M5-04** | `test_m5_no_go_status` | Authoritative `NO_GO` recommendation requiring staying moored | **PASSED** |
| **M5-05** | `test_m5_unknown_status` | Authoritative `UNKNOWN` recommendation with low confidence | **PASSED** |
| **M5-06** | `test_m5_safety_invariance` | `ResponseComposer` and `PromptInjectionGuard` tamper blocking | **PASSED** |
| **M5-07** | `test_m5_dependency_order` | Strict topological ordering (`marine`, `weather`, `hazard` -> `risk`) | **PASSED** |
| **M5-08** | `test_m5_marine_failure` | Marine gateway timeout yields conservative `UNKNOWN` (no fabrication) | **PASSED** |
| **M5-09** | `test_m5_weather_failure` | Weather gateway failure yields conservative `UNKNOWN` | **PASSED** |
| **M5-10** | `test_m5_risk_failure` | Internal Dev 4 engine crash caught safely, yielding `UNKNOWN` | **PASSED** |
| **M5-11** | `test_m5_fresh_domain_evaluation` | Multi-turn queries trigger fresh tool executions (no stale caching) | **PASSED** |
| **M5-12** | `test_m5_context_carry_forward` | Subsequent turn inherits active departure harbor from thread context | **PASSED** |
| **M5-13** | `test_m5_explicit_harbor_override` | Explicit new harbor in prompt cleanly overrides remembered harbor | **PASSED** |
| **M5-14** | `test_m5_evidence_grounding` | Evidence citations cover all decisive factors and numerical claims | **PASSED** |
| **M5-15** | `test_m5_multilingual_safety` | Localized Marathi and Hindi output with invariant status headers | **PASSED** |
| **M5-16** | `test_m5_no_llm_direct_tool_access` | Graph schema enforces tool execution only via specialist node | **PASSED** |

**Repository Test Summary:** **116/116 passed** in 1.70s. Linting: **0 ruff errors**.
