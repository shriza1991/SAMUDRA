# Milestone M6: Hazard & Geofence Flow

**Owned by Dev 3 (Agent Orchestration & Explainability)**  
**Part of SIH 2026 Problem Statement PS 26176 — ORCA / SAMUDRA**

---

## 1. M6 Objective

Milestone M6 delivers end-to-end orchestration for **marine hazards, storm warnings, geospatial geofences, maritime boundaries, and route safety assessments** across single-turn and multi-turn user workflows.

It enables SAMUDRA to seamlessly handle:
- Standalone hazard questions (e.g., *"Are there any cyclone warnings near Ratnagiri?"*)
- Standalone geofence & boundary questions (e.g., *"Are there any restricted zones near Goa?"*)
- Route hazard inquiries (e.g., *"Are there cyclone risks on my route from Mumbai to Goa?"*)
- Route boundary inquiries (e.g., *"Are there restricted areas along my route?"*)
- Combined multi-domain questions (e.g., *"Are there any cyclone or restricted-zone risks on my route from Mumbai to Goa?"*)

---

## 2. Architecture & Orchestration Flow

```
                           User Query
                               ↓
                       intent_locale_node
             ┌─────────────────┴─────────────────┐
    [Missing Route Context]             [Context Resolved]
             ↓                                   ↓
     clarification_node                   supervisor_node
    (Prompts for origin/dest)           (Dependency DAG Planner)
                                                 ↓
                                      specialist_tools_node
                           ┌─────────────────────┼─────────────────────┐
                           ↓                     ↓                     ↓
                     hazard_search       geospatial_hazard      route_analysis
                     (IMD Bulletins)     (Boundary Check)       (Route Exposure)
                           └─────────────────────┬─────────────────────┘
                                                 ↓
                                      evidence_validator_node
                                      (Audits Metric Citations)
                                                 ↓
                                      response_composer_node
                                 (Enforces Status & Invariance)
                                                 ↓
                                           terminal_node
```

### 2.1 Hazard-Only Flow
When a user asks about storm, cyclone, or squall warnings (e.g., *"Are there storm warnings off Mumbai?"*):
1. `intent_locale_node` classifies intent as `IntentCategory.HAZARDS` and extracts the departure harbor.
2. `supervisor_node` schedules only `["hazard_search"]`.
3. `specialist_tools_node` executes `hazard_search` via the registered `ProviderToolAdapter.adapt_hazard_bulletin`.
4. `evidence_validator_node` verifies `cyclone_warning_active` evidence item.
5. `response_composer_node` returns an authoritative IMD bulletin advisory.

### 2.2 Geofence-Only Flow
When a user asks about naval firing ranges, marine sanctuaries, or restricted areas (e.g., *"Are there restricted zones near Ratnagiri?"*):
1. `intent_locale_node` classifies intent as `IntentCategory.HAZARDS` (or `IntentCategory.ROUTE`).
2. `supervisor_node` schedules `["geospatial_hazard"]`.
3. `specialist_tools_node` executes `geospatial_hazard` via `ProviderToolAdapter.adapt_geospatial_hazard`.
4. `evidence_validator_node` verifies `geofence_intersection` evidence item.
5. `response_composer_node` synthesizes the boundary status.

### 2.3 Route Context Resolution (M6.3)
For queries referencing routes (*"on my route"*, *"from Mumbai to Goa"*, *"between Ratnagiri and Goa"*):
- **Priority 1**: Explicit origin and destination in the current user prompt (e.g., *"from Mumbai to Goa"* $\rightarrow$ `origin_harbor="Mumbai"`, `destination="Goa"`).
- **Priority 2**: Established `ThreadContext` from prior turns via `MemoryManager`.
- **Priority 3**: If either origin or destination is missing and cannot be resolved, the graph marks `clarification_needed = True`, records missing fields, and transitions to `clarification_node`.
- **Safety Invariant**: The system **never** invents or fabricates an origin or destination, and **never** falls back to Ratnagiri for route queries.
- **Explicit Overrides**: An explicit user correction (e.g., *"Actually, I'm sailing from Ratnagiri to Goa"*) unconditionally overrides stored memory context.

### 2.4 Combined Hazard + Geofence Flow (M6.5)
For combined queries (e.g., *"Are there cyclone or restricted-zone risks on my route from Mumbai to Goa?"*):
1. `supervisor_node` schedules `["hazard_search", "geospatial_hazard", "route_analysis"]` in strict DAG order.
2. `specialist_tools_node` runs all three specialists.
3. `response_composer_node` distinguishes:
   - Marine/weather hazards (`cyclone_warning_active`, `squall_alert`, `severity`)
   - Restricted/geofenced boundaries (`hard_stop`, `restricted`, `zone_type`, `distance_to_boundary_km`)
   - Route corridor exposure (`recommended_route_id`)
   - Overall operational recommendation

---

## 3. Strict Dependency Ordering & DAG Priorities

Dependency priority numbers enforced by `_enforce_dependency_order()`:
| Priority | Tool / Capability | Role |
|---|---|---|
| **10** | `marine_conditions` | Baseline oceanographic observations |
| **20** | `weather_conditions` | Coastal meteorological observations |
| **30** | `hazard_search` | Active IMD storm/cyclone warnings |
| **35** | `geospatial_hazard` | Marine protected area & boundary checks |
| **40** | `route_analysis` / `route_exposure` | Multi-waypoint corridor exposure evaluation |
| **50** | `pfz_search` | Potential fishing zone distance ranking |
| **60** | `risk_evaluation` | Deterministic safety gate |

If upstream marine conditions fail, downstream route analysis is aborted gracefully and marked failed.

---

## 4. Separation of Responsibilities: Dev 3 vs Dev 4

| Responsibility | Dev 3 (Agent Orchestration & Explainability) | Dev 4 (Spatial, Risk & Physical Engines) |
|---|---|---|
| **Polygon / Geodesic Math** | **NO** — Dev 3 never implements Shapely, ray-casting, or geospatial mathematics | **YES** — Dev 4 computes boundary intersections and distance buffers |
| **Cyclone Severity Calculation** | **NO** — Consumes typed `HazardBulletinPayload` | **YES** — Dev 2 / Dev 4 evaluates cyclone thresholds |
| **Route Geometry & Scoring** | **NO** — Dev 3 consumes `RouteExposurePayload` | **YES** — Dev 4 evaluates waypoint wave exposure |
| **Orchestration & DAG Dispatch** | **YES** — Plans specialist sequence via `ToolRegistry` | **NO** — Agnostic to agent graph topology |
| **Authoritative Safety Invariance** | **YES** — Enforces `RecommendationStatus` in composer | **YES** — Supplies authoritative status in payload |
| **Multilingual Presentation** | **YES** — Localizes response in English, Hindi, and Marathi | **NO** — Emits typed numeric/boolean domain data |

---

## 5. Hard-Stop & Restricted-Zone Enforcement (M6.6)

The system strictly respects authoritative boundary restrictions returned by Dev 4:

$$\begin{aligned}
\text{hard\_stop} = \text{True} \lor \text{cyclone\_warning\_active} = \text{True} &\implies \mathbf{RecommendationStatus.NO\_GO} \\
\text{restricted} = \text{True} \lor \text{squall\_alert} = \text{True} &\implies \mathbf{RecommendationStatus.CAUTION} \\
\text{critical dependency failed} &\implies \mathbf{RecommendationStatus.UNKNOWN} \\
\text{clean observations} &\implies \mathbf{RecommendationStatus.INFORMATIONAL}
\end{aligned}$$

### Safety Invariance Rules:
1. **No Softening Permitted**: Prohibited phrases (e.g., *"the route should probably be fine"*, *"you can proceed carefully"*, *"the restriction can be ignored"*, *"safe to proceed through the restricted area"*) are detected and rejected by `PromptInjectionGuard.audit_response_for_tampering()`.
2. **Invariance Audit**: `ResponseComposer.validate_safety_invariance()` guarantees that the final `ChatResponse.recommendation.status` matches the authoritative status.

---

## 6. Evidence Grounding & Provenance (M6.7)

`EvidenceValidator.audit_evidence()` audits all critical claims against verifiable evidence citations:
- `hazard_search` $\rightarrow$ `cyclone_warning_active` (source: IMD Hazard Division)
- `geospatial_hazard` $\rightarrow$ `geofence_intersection`, `distance_to_boundary_km` (source: Geospatial Hazard Engine)
- `route_analysis` $\rightarrow$ `recommended_route_id` (source: Route Exposure Engine)

If any critical metric lacks an evidence citation, `EvidenceValidator` records an operational warning without hallucinating provenance.

---

## 7. Failure Handling & Degradation Semantics

- **Hazard Service Down**: State marks `failed_tools=["hazard_search"]`, yields conservative `UNKNOWN` recommendation with low confidence and clear notice: *"Operational assessment incomplete due to upstream tool failure"*.
- **Geospatial Service Down**: State marks `failed_tools=["geospatial_hazard"]`, yields `UNKNOWN` recommendation with warning.
- **Partial Dependency Failure**: In combined queries, if `hazard_search` succeeds but `geospatial_hazard` fails:
  - Successful hazard observations (`cyclone_warning_active`) are preserved.
  - Missing geofence verification is explicitly reported.
  - Overall status conservatively remains `UNKNOWN`.

---

## 8. Multi-Turn Freshness & M4 Memory

`MemoryManager` enforces selective carry-forward:
- **Carried Forward**: `origin_harbor`, `destination`, `craft_profile`, `preferred_language`.
- **Never Frozen / Stale**: Past cyclone observations, hazard alerts, boundary checks, and risk recommendations are **never** persisted as frozen facts. Subsequent queries execute fresh domain tools.

---

## 9. Multilingual Support (M6.8)

Supports English (`en`), Marathi (`mr`), and Hindi (`hi`):
- Operational status tags remain immutable: `[NO_GO]`, `[CAUTION]`, `[UNKNOWN]`, `[INFORMATIONAL]`.
- Key decisive factors and actionable directives are fully localized.

---

## 10. Test Verification Matrix

All 28 required test cases are implemented and validated in `tests/agent_eval/test_m6_hazards.py`:

| # | Test Name | Purpose | Result |
|---|---|---|---|
| 1 | `test_01_hazard_intent_classification` | Hazard, cyclone, storm, and squall classification | **PASS** |
| 2 | `test_02_geofence_intent_classification` | Restricted zones, sanctuaries, firing zones | **PASS** |
| 3 | `test_03_hazard_tool_selection` | Supervisor schedules only `hazard_search` | **PASS** |
| 4 | `test_04_geofence_tool_selection` | Supervisor schedules only `geospatial_hazard` | **PASS** |
| 5 | `test_05_explicit_origin_destination_extraction` | Origin and destination extraction from prompt | **PASS** |
| 6 | `test_06_route_context_from_m4_memory` | Inherits route context across turns | **PASS** |
| 7 | `test_07_missing_route_clarification` | Missing route context triggers clarification | **PASS** |
| 8 | `test_08_explicit_route_override` | Explicit route overrides remembered context | **PASS** |
| 9 | `test_09_hazard_only_flow` | End-to-end hazard-only execution | **PASS** |
| 10 | `test_10_geofence_only_flow` | End-to-end geofence-only execution | **PASS** |
| 11 | `test_11_route_hazard_flow` | Orchestrates hazard search + route analysis | **PASS** |
| 12 | `test_12_combined_hazard_geofence_flow` | Orchestrates hazard + geofence + route analysis | **PASS** |
| 13 | `test_13_hard_stop_enforcement_no_go` | `hard_stop=True` strictly forces `NO_GO` | **PASS** |
| 14 | `test_14_restricted_zone_enforcement_caution` | `restricted=True` produces `CAUTION` | **PASS** |
| 15 | `test_15_llm_cannot_soften_hard_stop` | PromptInjectionGuard rejects softening phrases | **PASS** |
| 16 | `test_16_hazard_dependency_failure` | Hazard tool failure produces `UNKNOWN` | **PASS** |
| 17 | `test_17_geofence_dependency_failure` | Geofence tool failure produces `UNKNOWN` | **PASS** |
| 18 | `test_18_partial_dependency_failure` | Partial failure preserves data & sets `UNKNOWN` | **PASS** |
| 19 | `test_19_evidence_grounding` | EvidenceValidator audits critical metrics | **PASS** |
| 20 | `test_20_combined_evidence_grounding` | Combined citations collected from all tools | **PASS** |
| 21 | `test_21_multi_turn_route_carry_forward` | Multi-turn route survival in memory | **PASS** |
| 22 | `test_22_fresh_domain_evaluation` | No stale observation caching across turns | **PASS** |
| 23 | `test_23_english_hazard_geofence_response` | Localized English response format | **PASS** |
| 24 | `test_24_hindi_hazard_geofence_response` | Localized Hindi response format | **PASS** |
| 25 | `test_25_marathi_hazard_geofence_response` | Localized Marathi response format | **PASS** |
| 26 | `test_26_llm_cannot_directly_call_unregistered_tools` | Rejection of unregistered capabilities | **PASS** |
| 27 | `test_27_thread_isolation` | Complete isolation across thread sessions | **PASS** |
| 28 | `test_28_existing_m5_safety_regression` | Full backward compatibility with M5 safety | **PASS** |

- **Total Repository Test Suite**: **144/144 passing** in 1.74s
- **Linter Status**: **0 errors** (`py -m ruff check backend/app/agents tests/agent_eval`)
