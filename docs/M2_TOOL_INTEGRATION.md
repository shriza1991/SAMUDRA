# Milestone M2 — Tool Integration, Interfaces & Orchestration Hardening

**Project**: SAMUDRA (SIH 2026 PS 26176 — ORCA)  
**Milestone**: M2  
**Owner**: Dev 3 (Agent Orchestration, Conversation & Explainability)  
**Status**: COMPLETE  

---

## 1. Milestone Objectives Achieved

Milestone M2 establishes the complete Dev 3-side integration architecture, typed contracts, interfaces, adapters, and contract mocks before Dev 2 (connectors) and Dev 4 (marine calculations) begin their implementations.

Key accomplishments:
1. **Ownership Separation**: Established `ToolOwner` (`DEV2`, `DEV3`, `DEV4`) and attached ownership metadata to all tool definitions.
2. **Capability Taxonomy**: Defined canonical capabilities (`marine_conditions`, `weather_conditions`, `hazard_search`, `risk_evaluation`, `pfz_search`, `route_analysis`) and dynamic availability discovery.
3. **Typed Interface Protocols**: Defined `@runtime_checkable` protocols for Dev 2 (`MarineConditionsProvider`, `WeatherConditionsProvider`, `HazardBulletinsProvider`, `PFZSourceDataProvider`) and Dev 4 (`RiskEvaluationEngine`, `PFZRankingEngine`, `RouteExposureEngine`, `GeospatialHazardEngine`).
4. **Adapter Decoupling**: Built `ProviderToolAdapter` wrapping external providers into standardized `ToolResult` payloads with `EvidenceItem` citations.
5. **Contract Mocks (`M2_CONTRACT_MOCK`)**: Implemented high-fidelity test doubles stamped with `["M2_CONTRACT_MOCK", "SIMULATED"]` distinct from `M1_DEMO_DATA` and `REAL_SOURCE`.
6. **Robust Error Handling**: Standardized `ToolErrorCode` enum with helper semantics (`is_retryable`, `requires_clarification`, `is_user_safe`) and context validation.
7. **Supervisor Dependency Ordering**: Enforced execution ordering so upstream observation tools execute prior to downstream intelligence tools.
8. **Backward Compatibility**: Fully preserved all M0/M1 functionality; 41/41 tests passing across the entire repository.

---

## 2. Directory Structure & File Map

```
backend/app/agents/
├── integrations/                     # [M2 Core Architecture]
│   ├── __init__.py                   # Unified exports
│   ├── contracts.py                  # ToolOwner, ToolErrorCode, Context, Capabilities
│   ├── dev2.py                       # Dev 2 Protocols & Payload Schemas
│   ├── dev4.py                       # Dev 4 Protocols & Payload Schemas
│   ├── adapters.py                   # ProviderToolAdapter Normalization & Evidence Formatter
│   └── mocks.py                      # M2 Contract Mocks & Registration Helpers
├── tools.py                          # Hardened AgentToolRegistry with Capability Checks
├── graph.py                          # Updated Supervisor & Composer with tool_mode & capabilities
├── state.py                          # ORCAState with tool_mode and capability_error
└── __init__.py                       # Package exports
```

---

## 3. Tool Execution Modes in LangGraph

The graph runner `run_orca_graph()` supports two execution modes:

### `tool_mode="demo"` (Default — Backward Compatible)
- Uses M1 in-memory stubs (`pfz_stub`, `marine_stub`, `weather_stub`, `risk_stub`).
- Stamped with `["M1_DEMO_DATA"]`.
- Fast, zero-dependency vertical slice testing.

### `tool_mode="contract_mock"` (M2 Hardened Integration)
- Uses M2 contract mocks wrapped in `ProviderToolAdapter`.
- Stamped with `["M2_CONTRACT_MOCK", "SIMULATED"]`.
- Checks capability availability prior to planning.
- Orders tools according to dependency DAG.
- Validates context fields (`origin_harbor`, `craft_profile`) before dispatch.
- Returns safe `RecommendationStatus.UNKNOWN` if a required capability is unavailable.

---

## 4. Verification & Testing

The M2 test suite resides in `tests/agent_eval/test_m2_integration.py` (17 tests), alongside existing contract and graph tests:

```bash
# Run entire test suite (41 tests)
C:\Python313\python.exe -m pytest tests/contract/ tests/integration/ tests/agent_eval/ -v

# Run lint checks
C:\Python313\python.exe -m ruff check backend/app/agents tests/agent_eval
```

**Results**:
- 41/41 tests passing in ~0.65 seconds.
- 0 lint errors, 100% type-checked.
