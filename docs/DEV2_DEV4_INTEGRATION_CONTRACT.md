# SAMUDRA — Dev 2 & Dev 4 Master Integration Contract

**Milestone**: M2 (Integration Contracts, Tool Interfaces & Orchestration Hardening)  
**Author / Owner**: Dev 3 (Agent Orchestration, Conversation & Explainability)  
**Problem Statement**: SIH 2026 PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
**Target Audience**: Dev 2 (Backend Platform & Connectors), Dev 4 (Marine & Geospatial Domain Intelligence)  

---

## 1. System Overview & Architectural Boundaries

In SAMUDRA, specialist data retrieval and deterministic mathematical evaluations are strictly decoupled from conversational reasoning. The Agent Orchestrator (`Dev 3`) manages the cognitive graph, task planning, conversation memory, and natural-language synthesis. It **never** invokes raw external APIs directly and **never** performs geospatial or risk arithmetic inside LLM prompts.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                       DEV 3: AGENT ORCHESTRATOR                           │
│  - Intent & Locale Classification                                         │
│  - Supervisor / Task Planning & Dependency Ordering                       │
│  - Dynamic Capability Availability Discovery                              │
│  - Response Composition & Safety Invariance Verification                  │
│  - Sanitized Audit Trace (No CoT Leakage)                                 │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                         [ProviderToolAdapter]
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│     DEV 2: DATA CONNECTORS    │           │  DEV 4: INTELLIGENCE ENGINES  │
│  - INCOIS Ocean State (OSF)   │           │  - Deterministic Risk Engine  │
│  - IMD Weather Bulletins      │           │  - Geodesic PFZ Ranker        │
│  - IMD Severe Weather Alerts  │           │  - Channel Route Exposure     │
│  - Raw PFZ Satellite Feeds    │           │  - Shapely Geofence Auditing  │
│                               │           │                               │
│  * Implements Protocols in:   │           │  * Implements Protocols in:   │
│    backend/app/agents/        │           │    backend/app/agents/        │
│    integrations/dev2.py       │           │    integrations/dev4.py       │
└───────────────────────────────┘           └───────────────────────────────┘
```

---

## 2. Ownership Taxonomy

Explicit developer boundaries are enforced via `ToolOwner` (`backend/app/agents/integrations/contracts.py`):

| Owner | Component Scope | Must Implement | Must NEVER Do |
| :--- | :--- | :--- | :--- |
| **Dev 2** | Backend Platform & Data Connectors | External HTTP/REST connectors, caching, rate-limiting, DB repositories | Compute risk recommendations or generate mariner-facing text |
| **Dev 3** | Agent Orchestration & Explainability | LangGraph state flow, tool adapters, intent/locale, memory, evidence audit | Hardcode external URLs or perform GIS math |
| **Dev 4** | Marine, Geo, Risk & Route Intelligence | Deterministic Python risk rules, PFZ ranking, route safety math | Call external APIs or alter prompt generation |

---

## 3. Tool Invocation Context

All tools receive a standardized context structure:

```python
class ToolInvocationContext(BaseModel):
    origin_harbor: Optional[str] = "Ratnagiri"      # Required for coastal tools
    coordinates: Optional[List[float]] = [73.28, 16.99] # [lon, lat] EPSG:4326
    departure_time: Optional[str] = None           # ISO-8601 UTC timestamp
    duration_hours: float = 8.0                    # Voyage duration in hours
    craft_profile: str = "motorized_boat"          # traditional_non_motorized | motorized_boat | mechanized_trawler
    activity: str = "fishing"                      # fishing | transport | recreational
    destination: Optional[str] = None              # Target waypoint/bank
    user_constraints: Dict[str, Any] = {}          # e.g., max_distance_nm
```

---

## 4. Capability Catalog & Dependency Graph

Registered tools are grouped into formal capabilities managed by `AgentToolRegistry`:

| Capability | Providing Role | Dependencies | Critical Input Fields |
| :--- | :--- | :--- | :--- |
| `marine_conditions` | Dev 2 | None | `origin_harbor` |
| `weather_conditions` | Dev 2 | None | `origin_harbor` |
| `hazard_search` | Dev 2 | None | `origin_harbor` |
| `risk_evaluation` | Dev 4 | `marine_conditions`, `weather_conditions`, `hazard_search` | `origin_harbor`, `craft_profile` |
| `pfz_search` | Dev 4 | `marine_conditions` | `origin_harbor` |
| `route_analysis` | Dev 4 | `marine_conditions`, `hazard_search` | `origin_harbor`, `destination` |

### Supervisor Execution Order Guarantee:
When a safety query is dispatched, the Supervisor orders tool execution strictly by dependency:
$$\text{marine\_conditions} \rightarrow \text{weather\_conditions} \rightarrow \text{hazard\_search} \rightarrow \text{risk\_evaluation}$$

---

## 5. Dev 2 Connector Contracts (`dev2.py`)

Dev 2 must implement classes satisfying the following `@runtime_checkable` protocols.

### 5.1 Marine Conditions (`MarineConditionsProvider`)
```python
class MarineConditionsProvider(Protocol):
    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload: ...
```
**Required Payload Fields (`MarineConditionsPayload`)**:
- `harbor`: str
- `significant_wave_height_m`: float ($\ge 0.0$)
- `swell_height_m`: Optional[float]
- `swell_period_sec`: Optional[float]
- `surface_current_knots`: Optional[float]
- `sea_surface_temp_c`: Optional[float]
- `observed_at`: str (ISO-8601 UTC)
- `valid_to`: str (ISO-8601 UTC)
- `source_name`: str (Default: `"INCOIS Ocean State Forecast"`)
- `source_url`: Optional[str]

### 5.2 Weather Conditions (`WeatherConditionsProvider`)
```python
class WeatherConditionsProvider(Protocol):
    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload: ...
```
**Required Payload Fields (`WeatherConditionsPayload`)**:
- `harbor`: str
- `wind_speed_knots`: float ($\ge 0.0$)
- `wind_gust_knots`: Optional[float]
- `wind_direction_deg`: Optional[float] ($0.0 \dots 360.0$)
- `visibility_km`: Optional[float]
- `observed_at`: str (ISO-8601 UTC)
- `valid_to`: str (ISO-8601 UTC)
- `source_name`: str (Default: `"IMD Coastal Weather Bulletin"`)
- `source_url`: Optional[str]

### 5.3 Hazard Bulletins (`HazardBulletinsProvider`)
```python
class HazardBulletinsProvider(Protocol):
    def get_hazard_bulletin(self, context: ToolInvocationContext) -> HazardBulletinPayload: ...
```
**Required Payload Fields (`HazardBulletinPayload`)**:
- `harbor`: str
- `cyclone_warning_active`: bool
- `squall_alert`: bool
- `bulletin_id`: Optional[str]
- `severity`: str (`"NORMAL" | "ALERT" | "WARNING" | "SEVERE"`)
- `headline`: Optional[str]
- `valid_from`: Optional[str]
- `valid_to`: Optional[str]
- `source_name`: str (Default: `"IMD Hazard Warning Division"`)
- `source_url`: Optional[str]

---

## 6. Dev 4 Intelligence Contracts (`dev4.py`)

Dev 4 must implement deterministic algorithms satisfying these protocols:

### 6.1 Risk Evaluation (`RiskEvaluationEngine`)
```python
class RiskEvaluationEngine(Protocol):
    def evaluate_risk(
        self,
        context: ToolInvocationContext,
        marine: MarineConditionsPayload,
        weather: WeatherConditionsPayload,
        hazard: HazardBulletinPayload,
    ) -> RiskAssessmentPayload: ...
```
**Required Payload Fields (`RiskAssessmentPayload`)**:
- `status`: `RecommendationStatus` (`GO | CAUTION | NO_GO | UNKNOWN`)
- `summary`: str (Concise assessment)
- `decisive_factors`: List[str] (e.g. `["Wave height 2.6m exceeds 2.0m threshold"]`)
- `recommended_action`: str (e.g. `"Remain moored in port"`)
- `confidence_level`: `ConfidenceLevel` (`HIGH | MEDIUM | LOW`)
- `confidence_reasons`: List[str]
- `warnings`: List[str]

### 6.2 PFZ Ranking (`PFZRankingEngine`)
```python
class PFZRankingEngine(Protocol):
    def rank_pfz_candidates(
        self,
        context: ToolInvocationContext,
        raw_features: List[Dict[str, Any]],
        max_search_radius_nm: float = 50.0,
    ) -> PFZRankingPayload: ...
```
**Required Payload Fields (`PFZRankingPayload`)**:
- `origin_harbor`: str
- `total_candidates`: int
- `ranked_candidates`: List[`PFZCandidatePayload`]
  - `candidate_id`: str
  - `latitude`: float
  - `longitude`: float
  - `distance_nautical_miles`: float
  - `bearing_degrees`: float
  - `water_depth_m`: Optional[float]
  - `sea_surface_temp_c`: Optional[float]
  - `chlorophyll_mg_m3`: Optional[float]
  - `rank`: int (1-indexed)

### 6.3 Route Exposure (`RouteExposureEngine`)
```python
class RouteExposureEngine(Protocol):
    def evaluate_routes(
        self,
        context: ToolInvocationContext,
        marine: MarineConditionsPayload,
        destination: str,
    ) -> RouteExposurePayload: ...
```
**Required Payload Fields (`RouteExposurePayload`)**:
- `origin`: str
- `destination`: str
- `recommended_route_id`: str
- `routes`: List[`EvaluatedRouteItem`]
  - `route_id`: str
  - `name`: str
  - `distance_km`: float
  - `max_wave_height_m`: float
  - `risk_rating`: str (`"LOW" | "MODERATE" | "HIGH"`)
  - `exposure_score`: float
  - `waypoints`: List[[lon, lat]]

---

## 7. Standardized Error Handling Semantics

All tools wrapped by `ProviderToolAdapter` catch failures and return canonical `ToolResult` schemas with error codes from `ToolErrorCode`:

| Error Code | Meaning | Orchestrator Action | User-Facing Communication |
| :--- | :--- | :--- | :--- |
| `TOOL_NOT_REGISTERED` | Tool not in approved registry | Abort execution | "Service configuration error" |
| `MISSING_CONTEXT` | Mandatory parameter omitted | Halt & prompt mariner | "Please specify your departure harbor" |
| `TOOL_UNAVAILABLE` | External service offline | Supervisor falls back / halts | "Capability X is temporarily offline" |
| `INVALID_INPUT` | Coordinates or craft profile invalid | Prompt clarification | "Coordinates out of coastal bounds" |
| `UPSTREAM_FAILURE` | INCOIS/IMD gateway error | Bounded retry or cached fallback | "External marine bulletin unavailable" |
| `TIMEOUT` | Request exceeded latency cap | Retry or degraded result | "Coastal query timed out" |
| `PARTIAL_DATA` | Non-critical metric missing | Proceed with warning | Proceed with caution badge |
| `INVALID_RESULT` | Output violates contract schema | Reject payload | "Data verification error" |

---

## 8. Evidence Citations & Provenance Tracking

Every factual claim synthesized by SAMUDRA must be backed by an `EvidenceItem`:

```python
EvidenceItem(
    source_name="INCOIS Ocean State Forecast",
    source_url="https://incois.gov.in/portal/osf",
    observed_time="2026-09-05T04:00:00Z",
    valid_to="2026-09-08T18:00:00Z",
    retrieved_at="2026-09-05T05:10:00Z",
    metric_name="significant_wave_height",
    metric_value=1.6,
    metric_unit="meters",
    quality_flags=["M2_CONTRACT_MOCK", "SIMULATED"], # or ["REAL_SOURCE", "OFFICIAL"]
)
```

- **M1 Demo**: Quality flags tagged `["M1_DEMO_DATA"]`
- **M2 Contract Mocks**: Quality flags tagged `["M2_CONTRACT_MOCK", "SIMULATED"]`
- **M3/Production**: Quality flags tagged `["REAL_SOURCE", "OFFICIAL"]`

---

## 9. Handoff Checklists

### Dev 2 Handoff Checklist:
- [ ] Implement `MarineConditionsProvider` protocol (`backend/app/connectors/incois.py`)
- [ ] Implement `WeatherConditionsProvider` protocol (`backend/app/connectors/imd_weather.py`)
- [ ] Implement `HazardBulletinsProvider` protocol (`backend/app/connectors/imd_hazard.py`)
- [ ] Ensure all returned timestamps are ISO-8601 UTC strings
- [ ] Populate `source_name` and `source_url` on all payloads
- [ ] Handle network timeouts gracefully (timeout $\le 4.0$ seconds)
- [ ] Register implementations with `ProviderToolAdapter` in `backend/app/agents/tools.py`

### Dev 4 Handoff Checklist:
- [ ] Implement `RiskEvaluationEngine` protocol with craft-specific ceilings (`backend/app/services/risk_engine.py`)
- [ ] Implement `PFZRankingEngine` protocol using geodesic distance & chlorophyll metrics
- [ ] Implement `RouteExposureEngine` protocol comparing inshore vs deepwater channels
- [ ] Guarantee `RiskAssessmentPayload.status` is deterministic and immutable
- [ ] Provide decisive factors as human-readable bullet strings
- [ ] Test against edge cases (cyclone alert, extreme wave heights $>3.0\text{m}$, shallow reefs)
