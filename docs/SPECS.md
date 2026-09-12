# ORCA SPECS — System Requirements & Acceptance Criteria

## Canonical interfaces
Primary interaction: `POST /api/v1/chat`

Core shared models:
- ChatRequest
- ChatResponse
- VoiceChatResponse
- ToolResult
- EvidenceItem

Canonical definitions remain in docs/API_CONTRACTS.md and docs/CANONICAL_DATA_CONTRACTS.md.

## Runtime flow
1. Normalize input
2. Detect language/locale
3. Resolve mission context
4. Clarification gate
5. Intent classification
6. Supervisor planning
7. Specialist tool execution
8. Evidence normalization and validation
9. Deterministic safety/regulatory evaluation
10. Candidate elimination and ranking
11. Alternative generation
12. Response composition
13. Map/evidence/trace packaging
14. Persist run metadata

## Evidence
Every important numerical or safety claim must retain:
- source/product
- observed/issue time
- valid-from/to
- retrieved-at
- spatial applicability
- quality flags
- authority/usage classification

## Deterministic boundaries
LLMs may own:
- language understanding
- task decomposition
- bounded tool planning
- context handling
- explanation

Deterministic code owns:
- geodesics
- polygon intersections
- freshness/validity
- hard safety/regulatory constraints
- feasibility
- ranking calculations
- provenance-based confidence

## Safety
The rules in docs/SAFETY.md are invariant. No feature may weaken or bypass them.

## Data modes
- LIVE: Query live provider; fail explicitly with structured error if unreachable.
- HYBRID: Query live provider; fall back to verified snapshot on failure; record degradation warning.
- SNAPSHOT: Zero network access; load local validated fixtures only.

Each mode must have explicit behavior and tests.

## Source Status Model
Every external data source declares one of:
- `LIVE`: Verified real-time machine-readable retrieval at runtime.
- `LIMITED`: Service exists but access, API key, rate-limits, or formats limit full production use.
- `CACHED_REAL`: Authoritative real data pre-captured and stored with provenance.
- `HISTORICAL`: Research/reference archival dataset.
- `MOCK`: Synthetic test data used only for unit testing and offline demo fallback.

Never mark a source as LIVE without runtime verification.

## P0 Core Integration Acceptance Criteria

### 1. INCOIS Ocean State Forecast (OSF)
- Fetches significant wave height ($m$), swell height ($m$), swell period ($s$), and surface currents ($knots$).
- Ingested via connector with $\le 3.5s$ timeout.
- Successfully validates against `MarineConditionsPayload`.

### 2. INCOIS Potential Fishing Zones (PFZ)
- Ingests active PFZ advisories, sea surface temperature gradients, and ocean color lines.
- Computes geodesic distance and compass bearing from origin harbor.
- Successfully validates against `PFZRankingPayload`.

### 3. INCOIS SVAS (Small Vessel Advisory Services)
- Evaluates vessel craft safety indices against craft limits (`traditional_non_motorized`, `motorized_boat`, `mechanized_trawler`).
- Successfully validates against `SVASAdvisoryPayload`.

### 4. IMD Marine Bulletins & Hazards
- Parses coastal sea bulletins, port warning signals, and squall/cyclone alerts.
- Triggers deterministic hard-stops on Red Alerts within 50 nm.
- Successfully validates against `WeatherConditionsPayload` and `HazardBulletinPayload`.

### 5. Pilot-Region GIS Geofencing
- Evaluates polygon intersections against Naval Firing Ranges, MPAs (Malvan), and IMBL buffers.
- Point-in-polygon and line-string intersections execute via Shapely in $<50ms$.

### 6. Open-Meteo Marine Redundancy
- Provides live fallback for wave heights and winds when primary feeds time out.
- Strictly flagged with secondary fallback provenance.

## Release quality gates
- contract tests
- deterministic domain tests
- connector tests
- agent evaluation
- integration tests
- frontend build/type checks
- failure injection
- safety regression tests
- provenance checks
- clean packaging

