# M7 Route Reasoning Flow

**Milestone**: M7  
**Owner**: Dev 3 — Agent Orchestration & Explainability  
**Status**: ✅ Implemented  
**Test Coverage**: 45 tests — all passing (`tests/agent_eval/test_m7_route.py`)

---

## Overview

M7 extends the ORCA LangGraph pipeline so that route-comparison queries are handled by a fully evidence-grounded, dependency-ordered orchestration that:

1. Selects a **complete, deterministic capability plan** for ROUTE intent that satisfies all declared dependency chains
2. **Preserves multiple route candidates** from Dev 4's `RouteExposureEngine` in `state["route_candidates"]`
3. **Compares candidates deterministically** using only Dev 4's own output fields (`recommended_route_id`, `risk_rating`, `exposure_score`)
4. **Produces a dedicated multilingual response** listing both candidates with the authoritative `[STATUS]` header
5. **Preserves all M0–M6 safety invariants** — `NO_GO` and `CAUTION` can never be softened by LLM composition

---

## Scope Boundary

Dev 3 owns **orchestration and explainability only**. M7 does **not** implement:

| Out of Scope | Owner |
|---|---|
| Route scoring algorithms | Dev 4 |
| Geographic distance calculations | Dev 2 / Dev 4 |
| Weather/hazard detection | Dev 2 |
| Risk thresholds | Dev 4 |
| Geofence intersection mathematics | Dev 4 |

Dev 3 reads **only** the fields that Dev 4's authoritative engines already populate.

---

## Architecture

### Intent Routing (supervisor_node)

**ROUTE intent** (`IntentCategory.ROUTE`) now has its **own capability plan**, separate from `HAZARDS`:

```python
# M7: Full route comparison plan
required_capabilities = [
    "marine_conditions",    # rank 10 — dependency of route_analysis, risk_evaluation
    "weather_conditions",   # rank 20 — dependency of risk_evaluation
    "hazard_search",        # rank 30 — dependency of route_analysis, risk_evaluation
    "geospatial_hazard",    # rank 35 — restricted-zone route exposure
    "route_analysis",       # rank 60 — primary route comparison (Dev 4)
    "risk_evaluation",      # rank 80 — authoritative safety status (Dev 4)
]
```

The existing `_enforce_dependency_order()` function produces the correct execution sequence based on declared dependency ranks — no rank changes needed.

**HAZARDS intent** (`IntentCategory.HAZARDS`) keeps its M6 keyword-sniffing logic unchanged, including the `has_route` path that adds `route_analysis` for queries like "cyclone risks on my route from X to Y".

### Dependency Contract Satisfaction

| Capability | Declared Dependencies (CAPABILITIES_CATALOG) | Status |
|---|---|---|
| `route_analysis` | `[marine_conditions, hazard_search]` | ✅ Both in M7 plan |
| `risk_evaluation` | `[marine_conditions, weather_conditions, hazard_search]` | ✅ All three in M7 plan |
| `geospatial_hazard` | `[]` | ✅ No deps required |

### Route Candidate Preservation (specialist_tools_node)

After `route_analysis` executes successfully, the `routes` list from `RouteExposurePayload` is extracted and written to:
- `state["route_candidates"]` — preserved for the full pipeline
- `observations["route_comparison"]` — deterministic comparison summary

### `_compare_route_candidates()` Helper

Pure, deterministic function that reads **only** Dev 4's own output fields:

```python
def _compare_route_candidates(
    route_candidates: List[Dict[str, Any]],
    observations: Dict[str, Any],
) -> Dict[str, Any]:
    """Reads: recommended_route_id, risk_rating, exposure_score.
    Never invents thresholds or scoring formulas.
    """
```

Output stored in `observations["route_comparison"]`:
```python
{
    "recommended_route_id": str,   # Dev 4 authoritative
    "candidates": [                # Per-route summary from Dev 4
        {
            "route_id": str,
            "name": str,
            "risk_rating": str,    # LOW | MODERATE | HIGH (Dev 4)
            "exposure_score": float,
            "distance_km": float,
            "max_wave_height_m": float,
        }
    ],
    "comparison_basis": "Dev 4 RouteExposureEngine (risk_rating + exposure_score)",
}
```

### Route Response Template (response_composer_node)

The `ROUTE` intent now has a **dedicated response composer branch** separate from `HAZARDS`. It:

1. Reads `route_comparison` from observations (populated by `_compare_route_candidates`)
2. Reads authoritative `risk_assessment` from `risk_evaluation` as the single source of truth
3. Falls back to hazard/geofence signals only if `risk_evaluation` failed or yielded `UNKNOWN`
4. Lists both candidate routes with Dev 4's `risk_rating` and `exposure_score`
5. Marks the Dev 4 recommended route with ✓
6. States the `[STATUS]` header from the authoritative risk engine

**Demo mode** (`tool_mode="demo"`) uses the existing M1 stub template — unchanged.

---

## Multilingual Support

| Language | Header | Keywords |
|---|---|---|
| English | `[STATUS] Route Safety Comparison (from X to Y):` | route, passage, channel, waypoint |
| Hindi | `[STATUS] मार्ग सुरक्षा तुलना (X से Y):` | रास्ता, मार्ग |
| Marathi | `[STATUS] मार्ग सुरक्षा तुलना (X ते Y):` | मार्ग |

---

## Safety Invariants

| Invariant | Mechanism |
|---|---|
| `NO_GO → NO_GO` | `ResponseComposer.validate_safety_invariance()` (reused from M5) |
| LLM cannot soften status | `PromptInjectionGuard.audit_response_for_tampering()` (reused from M5) |
| No fabricated route scores | `_compare_route_candidates()` reads only `recommended_route_id`, `risk_rating`, `exposure_score` from Dev 4 |
| Failed tool → incomplete not safe | Conservative `UNKNOWN` semantics from M5/M6 reused |
| `[STATUS]` always present | Response composer always prefixes with `[{rec.status.value}]` |

---

## Files Changed

| File | Change |
|---|---|
| [`backend/app/agents/graph.py`](file:///c:/Users/dyara/SAMUDRA/backend/app/agents/graph.py) | `supervisor_node`, `_compare_route_candidates()`, `specialist_tools_node`, `response_composer_node` |
| [`tests/agent_eval/test_m7_route.py`](file:///c:/Users/dyara/SAMUDRA/tests/agent_eval/test_m7_route.py) | [NEW] 45 M7 tests |
| [`docs/M7_ROUTE_REASONING.md`](file:///c:/Users/dyara/SAMUDRA/docs/M7_ROUTE_REASONING.md) | [NEW] This document |
| [`docs/DEV3_PROGRESS.md`](file:///c:/Users/dyara/SAMUDRA/docs/DEV3_PROGRESS.md) | Updated M7 milestone log |

### Files NOT Changed

| File | Reason |
|---|---|
| `backend/app/agents/contracts.py` | `CAPABILITIES_CATALOG` already correct for M7 |
| `backend/app/agents/integrations/mocks.py` | All `ToolDefinition` entries already correct |
| `backend/app/agents/graph.py` — `_enforce_dependency_order()` | Rank assignments already produce correct ordering |
| `backend/app/agents/integrations/adapters.py` | All adapters already exist |
| `backend/app/agents/evidence.py` | Already audits `recommended_route_id` for ROUTE intent |
| All M0–M6 tests | Zero regression; all 144+ pre-existing tests still pass |

---

## Test Coverage

| Class | Tests | Coverage Area |
|---|---|---|
| `TestM7RouteIntentClassification` | 6 | ROUTE intent from en/hi/mr queries |
| `TestM7ContextResolution` | 3 | Origin/destination from message and context |
| `TestM7CapabilityPlan` | 6 | All 6 capabilities in plan |
| `TestM7DependencyOrdering` | 4 | marine→route→risk ordering |
| `TestM7RouteCandidatePreservation` | 3 | Candidate list population |
| `TestM7ComparisonLogic` | 3 | `_compare_route_candidates()` + observations |
| `TestM7AuthoritativeStatus` | 4 | GO/CAUTION/NO_GO hierarchy |
| `TestM7FailureSemantics` | 3 | Partial failure graceful handling |
| `TestM7EvidenceGrounding` | 3 | Evidence citations for all tools |
| `TestM7MultilingualSupport` | 4 | en/hi/mr response headers + status invariant |
| `TestM7Regression` | 6 | M0–M6 flows unaffected |
| **Total** | **45** | **All passing** |

---

## Usage Examples

### English

```
User: Which route is safer from Ratnagiri to Outer Bank?

[INFORMATIONAL] Route Safety Comparison (from Ratnagiri to Outer Bank):

Evaluated Passage Options:
  • ROUTE-A-INSHORE — Inshore Passage: LOW risk | 26.5 km | wave exposure 1.3m | exposure score 2.1 ✓ [RECOMMENDED by Dev 4]
  • ROUTE-B-DIRECT — Direct Offshore: MODERATE risk | 20.2 km | wave exposure 2.1m | exposure score 4.8

Cyclone Warning: None active
Restricted Zone Status: Clear of known restrictions

Key Decisive Factors:
- Route ROUTE-A-INSHORE (Inshore Passage): LOW risk, exposure score 2.1, 26.5 km
- Dev 4 recommended route: ROUTE-A-INSHORE (lowest exposure)
...
```

### Marathi

```
User: रत्नागिरी ते गोवा मार्ग सुरक्षित आहे का?

[INFORMATIONAL] मार्ग सुरक्षा तुलना (Ratnagiri ते Goa):
...
```

### Hindi

```
User: वेरावल से गोवा का रास्ता सुरक्षित है?

[INFORMATIONAL] मार्ग सुरक्षा तुलना (Veraval से Goa):
...
```
