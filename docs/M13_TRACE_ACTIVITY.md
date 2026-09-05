# Milestone M13 — Trace / Agent Activity Architecture

> **Project:** SAMUDRA — Smart Autonomous Marine Understanding, Decision & Risk Assistant  
> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Milestone:** M13 — Public Execution Trace & Agent Activity Observability  
> **Owner:** Dev 3 — Agent Orchestration, Conversation & Explainability  

---

## 1. Executive Summary & Purpose

Milestone M13 provides complete, public-facing observability and auditability for SAMUDRA's multi-agent LangGraph workflow. The agent execution trace exposes **what** cognitive steps and specialist tools executed, their status, duration, and associated evidence citations, while strictly guaranteeing that private reasoning, system prompts, chain-of-thought tokens, and internal credentials are never exposed.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ORCA EXECUTION TRACE                            │
│                                                                        │
│  [Step 1]  Intent & Locale Node        ✓ Completed (12.4ms)            │
│  [Step 2]  Supervisor / Planner Node   ✓ Completed (4.1ms)             │
│  [Step 3]  Specialist Tool: Marine     ✓ Completed (45.2ms) [EV101]    │
│  [Step 4]  Specialist Tool: Weather    ✓ Completed (38.7ms) [EV102]    │
│  [Step 5]  Specialist Tool: Risk Eval  ✓ Completed (18.3ms) [EV103]    │
│  [Step 6]  Evidence Validator          ✓ Completed (6.8ms)             │
│  [Step 7]  Response Composer           ✓ Completed (15.1ms)            │
│  [Step 8]  Terminal Finalization       ✓ Completed (1.2ms)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Public Trace Event Schema

Every event in the pipeline conforms to `AgentTraceItem` (and internal `TraceEvent`):

| Field | Type | Description |
| :--- | :--- | :--- |
| `step` | `int` | Sequential 1-indexed execution step number. |
| `node` | `str` | LangGraph node name (e.g. `Supervisor / Planner`, `Specialist Tool: marine_stub`). |
| `agent` | `str` | Canonical agent identifier (`intent_locale`, `specialist_tools`, `response_composer`). |
| `action` | `str` | Sanitized, user-comprehensible summary of work executed in this step. |
| `status` | `str` | Execution state: `completed`, `failed`, `degraded`, `blocked`, `sanitized`, `skipped`. |
| `duration_ms` | `float` | Wall-clock execution time in milliseconds ($\ge 0.0$). |
| `evidence_ids` | `List[str]` | IDs of evidence items produced or consumed during this step. |
| `error` | `Optional[str]` | Sanitized error code or description if status is `failed` or `degraded`. |
| `tool_name` | `Optional[str]` | Tool name if the event represents an individual specialist tool execution. |
| `timestamp` | `str` | ISO-8601 UTC timestamp. |

---

## 3. Privacy & Security Invariants

The trace generation engine strictly enforces:

1. **No Chain-of-Thought (CoT) Leakage**:
   - Strips `<think>...</think>`, `<scratchpad>`, and `Thought:` prefixes from all actions and error logs via `PromptInjectionGuard`.
2. **No System Prompt Leakage**:
   - System prompts, developer instructions, and private schemas are never emitted to trace actions.
3. **No Secret / Credential Leakage**:
   - API keys, auth tokens, database credentials, and internal passwords are redacted before trace recording.
4. **Safety Invariance Unaffected**:
   - The trace logger is purely observational. It never modifies Dev 4's authoritative risk status (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`).

---

## 4. Test Verification Matrix (`tests/agent_eval/test_m13_trace.py`)

All 24 automated tests for M13 verify the following behaviors:

- `test_1_trace_event_schema_validation`: TraceEvent schema conformant with AgentTraceItem.
- `test_2_intent_node_trace_event`: Intent and locale detection records step 1 event.
- `test_3_planner_supervisor_trace_event`: Supervisor records task plan construction and tool list.
- `test_4_specialist_tool_trace_events`: Each specialist tool records individual execution status and duration.
- `test_5_evidence_ids_propagated_into_trace`: Evidence IDs (`EV-...`) are attached to tool trace events.
- `test_6_risk_evaluation_trace_event`: Risk evaluation execution recorded accurately.
- `test_7_evidence_validator_trace_event`: Evidence validator records audit count and quality summary.
- `test_8_response_composer_trace_event`: Response composer records synthesis and status header.
- `test_9_duration_is_populated_and_non_negative`: All trace events have valid non-negative `duration_ms`.
- `test_10_failed_tool_creates_failed_trace_event`: Tool failures produce `failed` trace events with sanitized errors.
- `test_11_failed_capability_node_trace`: Unavailable capabilities log fallback trace without crashing.
- `test_12_clarification_flow_traces_only_executed_nodes`: Clarification flow prunes unexecuted specialist tools.
- `test_13_final_trace_preserves_execution_order`: Trace sequence is strictly monotonically increasing ($1..N$).
- `test_14_parallel_tool_execution_representation`: Tool dispatch is cleanly represented in execution order.
- `test_15_no_chain_of_thought_in_trace`: Verifies zero `<think>` or `Thought:` tokens in trace.
- `test_16_no_system_prompt_in_trace`: Verifies zero system prompt instructions in trace.
- `test_17_no_secrets_in_trace`: Verifies automated masking of credentials in trace actions/errors.
- `test_18_existing_m10_evidence_ids_valid`: Validates M10 evidence ID continuity with trace.
- `test_19_m5_safety_status_unchanged_by_tracing`: Validates Dev 4 safety immutability under tracing.
- `test_20_m8_multi_turn_behavior_unchanged`: Validates multi-turn memory audit logging in trace.
- `test_21_m9_language_behavior_unchanged`: Validates multilingual output with English/Hindi/Marathi trace support.
- `test_22_m12_security_behavior_intact`: Validates injection blocking and secret audit trace events.
- `test_23_dev1_trace_contract_stability_and_json`: JSON serialization and Dev 1 contract compatibility.
- `test_24_full_m0_m12_regression`: End-to-end regression across all query types.
