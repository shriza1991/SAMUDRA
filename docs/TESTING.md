# SAMUDRA Testing Strategy & Scenarios

> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Testing Principle:** High test coverage on deterministic tools and contract validation; automated scenario evaluation for agent outputs.

---

## 1. Test Suite Architecture

```
tests/
├── contract/       # Validates Pydantic & TypeScript schema parity (ChatResponse, ToolResult)
├── domain/         # Deterministic calculations (Shapely geofences, geodesic distance, risk rules)
├── integration/    # FastAPI route tests, database sessions, connector fallback logic
└── agent_eval/     # LangGraph node unit tests, intent classification, multi-lingual evaluation
```

### Running Test Commands:
```bash
# Run all backend unit & contract tests
pytest

# Run only deterministic domain & risk tests
pytest tests/domain/

# Run schema contract tests
pytest tests/contract/

# Run integration tests against FastAPI
pytest tests/integration/

# Run frontend unit & component tests
cd frontend && npm run test
```

---

## 2. The Eight Canonical Benchmark Scenarios (S1 – S8)

These eight scenarios form the canonical test matrix and correspond to offline JSON fixtures in `data/fixtures/`:

### Scenario S1: Normal Favorable Sea State
- **Query**: *"Is it safe to go fishing off Mumbai coast for the next 6 hours?"*
- **Conditions**: SWH 0.9m, Wind 10 kts, IMD No Alert, INCOIS Fresh.
- **Expected Outcome**:
  - `recommendation.status`: `GO`
  - `confidence.level`: `HIGH`
  - Map shows green indicator and clear sea sector.

### Scenario S2: Elevated Sea State
- **Query**: *"Leaving Mangalore harbor at 05:00 on motorized fiber boat for 12 hours. Safe?"*
- **Conditions**: SWH 2.2m, Wind 22 kts, Swell period 11s, No cyclone.
- **Expected Outcome**:
  - `recommendation.status`: `CAUTION`
  - `decisive_factors`: Notes wave height is elevated for small motorized craft.
  - `next_action`: Mechanized vessels may proceed with vigilance; traditional non-motorized should defer.

### Scenario S3: Severe Marine / Cyclone Alert
- **Query**: *"Can we sail out from Paradip port tonight?"*
- **Conditions**: IMD Cyclone Warning (Deep Depression, wind gusts 45 kts, SWH 4.2m).
- **Expected Outcome**:
  - `recommendation.status`: `NO_GO` (Hard-stop triggered).
  - Red alert polygon rendered on MapLibre canvas.
  - Clear emergency warnings to remain in harbor.

### Scenario S4: Missing / Stale Critical Forecast
- **Query**: *"Is it safe to depart Kavaratti (Lakshadweep) right now?"*
- **Conditions**: Local observation offline, latest telemetry >30 hours old.
- **Expected Outcome**:
  - `recommendation.status`: `UNKNOWN`
  - Explicit warning: *"Data stale (>24h). Cannot certify safety."*
  - Strict adherence: System does **NOT** default to `GO`.

### Scenario S5: Nearest Potential Fishing Zone (PFZ)
- **Query**: *"Where is the nearest Potential Fishing Zone today from Ratnagiri?"*
- **Conditions**: Active INCOIS PFZ advisory along Maharashtra coast.
- **Expected Outcome**:
  - `intent`: `NEAREST_PFZ`
  - Ranked PFZ candidates with geodesic distance (km) and compass bearing.
  - Point/Polygon layer added to map with chlorophyll and SST metadata.

### Scenario S6: Route Crosses Restricted Maritime Polygon
- **Query**: *"Plan a direct fishing trip from Kochi harbor to Sector Delta."*
- **Conditions**: Direct geodesic route intersects an active Naval Firing Exercise polygon.
- **Expected Outcome**:
  - `recommendation.status`: `NO_GO`
  - Identified conflict with polygon ID `NAV-EX-SOUTH-02`.
  - Prohibited zone highlighted in red on map with coordinate boundary tags.

### Scenario S7: Safer Alternative Route Comparison
- **Query**: *"Which of these two coastal routes from Veraval to Porbandar has lower wave and wind risk?"*
- **Conditions**: Route A stays offshore (SWH 2.8m); Route B stays in coastal lee (SWH 1.5m).
- **Expected Outcome**:
  - Candidate Route B recommended with lower exposure score.
  - Comparative breakdown table showing distance vs. maximum wave height.
  - MapLibre renders Route A in Amber/Red and Route B in Green.

### Scenario S8: Multi-lingual Multi-Turn Follow-Up (Hindi / Marathi)
- **Turn 1 (Marathi)**: *"रत्नागिरीवरून उद्या सकाळी मासेमारीला जाणे सुरक्षित आहे का?"* (Is it safe to go fishing tomorrow morning from Ratnagiri?)
- **Outcome 1**: Responds in grammatically correct Marathi with clear `NO_GO` / `CAUTION` banner.
- **Turn 2 (Follow-up)**: *"आणि सर्वात जवळचे मासेमारी क्षेत्र कुठे आहे?"* (And where is the nearest fishing zone?)
- **Outcome 2**: Retains conversational context (Ratnagiri harbor) and provides PFZ distance and direction in Marathi.

---

## 3. Automated Guardrail Evaluation Checklist
For every PR affecting the agent graph:
- [ ] Ensure **zero** private system prompt or chain-of-thought tokens leak into `ChatResponse.answer`.
- [ ] Ensure deterministic rule engine takes precedence over LLM output in conflicting test cases.
- [ ] Verify that every decimal measurement in `ChatResponse.answer` has an exact match in `ChatResponse.evidence`.
