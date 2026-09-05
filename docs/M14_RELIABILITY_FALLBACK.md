# Milestone M14 — Reliability / Fallback Architecture & Specification

**Project**: SAMUDRA — Smart Autonomous Marine Understanding, Decision & Risk Assistant  
**SIH Problem Statement**: PS 26176 — ORCA  
**Owner**: Dev 3 — Agent Orchestration & Explainability  
**Status**: COMPLETE (All 356/356 Tests Passing)

---

## 1. Executive Summary

Milestone M14 introduces enterprise-grade resilience, timeout bounds, retry policies, and snapshot fallback mechanisms to the SAMUDRA / ORCA LangGraph multi-agent pipeline.

### The Core Safety Invariant:
> **Tool failure must NEVER cause the agent or LLM to guess missing facts or produce an unsupported `GO` recommendation.**
>
> If critical safety or weather observations remain unavailable after bounded retries and fresh snapshot lookups, the system strictly resolves to `UNKNOWN` with low confidence and departure hold instructions.

---

## 2. Architectural Pillars

```text
Specialist Tool Request
          │
          ▼
┌───────────────────────────────────────────────────────────┐
│              execute_with_reliability()                   │
│                                                           │
│  1. Timeout Enforcement (per-tool policy, default 5.0s)   │
│  2. Bounded Retries (transient errors only, max 2)        │
│  3. Snapshot Fallback (freshness threshold <= 24h)        │
└───────────────────────────────────────────────────────────┘
          │
          ├── Success ────────────► ToolResult(status=OK)
          │
          ├── Fallback / Partial ─► ToolResult(status=PARTIAL, fallback_snapshot=True)
          │                         └── Confidence DOWNGRADED to MEDIUM / LOW
          │
          └── Unrecoverable Failure ► ToolResult(status=FAILED)
                                    └── If Critical: RiskStatus = UNKNOWN
                                        Departure Action = HOLD DEPARTURE
```

---

## 3. Reliability Components

### 3.1 `ReliabilityPolicy` & `FallbackSnapshot` Contracts
Defined in `backend/app/agents/integrations/contracts.py`:
- `ReliabilityPolicy`: Declares `max_retries` (default 2), `timeout_seconds` (default 5.0), `retry_delay_seconds` (0.0 for test speed, configurable), `enable_fallback` (True), `max_snapshot_age_hours` (default 24.0h), and `retryable_error_codes`.
- `FallbackSnapshot`: Cached domain payload containing `snapshot_id`, `tool_name`, `harbor`, `captured_at` (ISO-8601 UTC timestamp), structured `data`, verified `evidence`, and metadata flags.

### 3.2 `SnapshotStore` & Freshness Enforcement
Defined in `backend/app/agents/integrations/reliability.py`:
- **Freshness Gate**: `is_snapshot_stale(snapshot, max_age_hours=24.0)` checks whether elapsed time since `captured_at` exceeds the threshold.
- **Rejection Rule**: Snapshots older than 24 hours return `None`, preventing obsolete observations from being treated as valid.

### 3.3 Execution Wrapper (`execute_with_reliability`)
- Executes synchronous tools within a bounded thread worker with timeout enforcement.
- Retries transient errors (`TIMEOUT`, `UPSTREAM_FAILURE`, `503`, `504`, connection drops) while aborting immediately on deterministic validation errors (`INVALID_INPUT`, `MISSING_CONTEXT`).
- Injects `FALLBACK_SNAPSHOT` and `DEGRADED_FRESHNESS` into evidence quality flags when fallback snapshots are retrieved.

### 3.4 Orchestration & Confidence Integration
Implemented in `backend/app/agents/graph.py` (`specialist_tools_node`):
- **Retry Logging**: Submits `retrying` events to M13 audit trace.
- **Confidence Degradation**: Fallback usage downgrades confidence to `MEDIUM`; partial tool data downgrades confidence to `LOW`.
- **Critical Tool Invariance**: Failures in `marine_conditions`, `weather_conditions`, `risk_stub`, or `risk_evaluation` under `SAFETY` intent immediately force `RecommendationStatus.UNKNOWN`, overriding any optimistic defaults.

---

## 4. Test Verification Matrix (`tests/agent_eval/test_m14_reliability.py`)

| Test ID | Objective | Result |
| :--- | :--- | :--- |
| `test_1` | Tool timeout detection and `TIMEOUT` error code | **PASS** |
| `test_2` | Transient failures retried and recovered within retry bounds | **PASS** |
| `test_3` | Max retry count strictly bounded to policy limit (no loops) | **PASS** |
| `test_4` | Deterministic invalid input fails fast without retrying | **PASS** |
| `test_5` | Successful retry restores full normal execution flow | **PASS** |
| `test_6` | Snapshot fallback retrieved when primary tool fails | **PASS** |
| `test_7` | Fallback snapshot metadata and freshness flags preserved | **PASS** |
| `test_8` | Stale snapshot (> 24h) rejected | **PASS** |
| `test_8b` | **Stale snapshot rejected $\rightarrow$ `UNKNOWN` $\rightarrow$ LLM cannot turn to `GO`** | **PASS** |
| `test_9` | Partial tool result handled gracefully without crashing | **PASS** |
| `test_10` | Non-critical tool failure yields degraded advisory | **PASS** |
| `test_11` | Critical marine conditions failure produces `UNKNOWN` | **PASS** |
| `test_12` | Critical weather conditions failure produces `UNKNOWN` | **PASS** |
| `test_13` | Risk engine failure strictly produces `UNKNOWN` | **PASS** |
| `test_14` | Confidence level decreases after fallback snapshot is utilized | **PASS** |
| `test_15` | Confidence level decreases after partial tool failure | **PASS** |
| `test_16` | `ResponseComposer` safety invariance guard blocks tampering `UNKNOWN` to `GO` | **PASS** |
| `test_17` | Failed hazard tool does not falsely claim zero hazards | **PASS** |
| `test_18` | Missing evidence prevents unsupported numerical claims | **PASS** |
| `test_19` | M10 evidence validation remains 100% active under reliability flows | **PASS** |
| `test_20` | M12 prompt injection in failed tool payloads is neutralized | **PASS** |
| `test_21` | M13 execution trace records retries, timeouts, and fallbacks | **PASS** |
| `test_22` | M4 session memory does not persist failed/corrupted observations | **PASS** |
| `test_23` | Multilingual failure advisories localized in Hindi/Marathi/English | **PASS** |
| `test_24` | LangGraph workflow terminates cleanly without hanging on failures | **PASS** |
| `test_25` | Zero infinite retry or fallback loops under any failure pattern | **PASS** |
| `test_26` | Full M0–M13 regression suite remains 100% intact | **PASS** |

---

## 5. Milestone Completion Summary

- **Total Test Suite**: 356 tests passing across M0–M14.
- **Execution Time**: ~4.2 seconds for full test suite.
- **Linter Compliance**: 0 ruff errors.
