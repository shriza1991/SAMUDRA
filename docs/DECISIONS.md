# ORCA Decisions

Only cross-cutting decisions go here.

## D001 — Modular Monolith
Status: ACCEPTED

Keep the initial product as a modular monolith with bounded internal contexts.

Reason: Faster parallel development and simpler deployment.

## D002 — Deterministic Safety Authority
Status: ACCEPTED

Deterministic domain code owns safety states, constraints, geometry, and threshold calculations.

Reason: Safety-critical calculations must be reproducible and auditable.

## D003 — Evidence-First Provenance
Status: ACCEPTED

Recommendations retain source, time, validity, quality, and authority metadata.

## D004 — Contract-First Parallel Development
Status: ACCEPTED

Shared interfaces are changed before dependent consumers.

## D005 — LIVE / HYBRID / SNAPSHOT
Status: ACCEPTED

All external data paths explicitly declare operating mode.

## D006 — Develop as Integration Branch
Status: ACCEPTED

Members work on team/* branches, merge continuously to develop, then promote verified releases to main.

## D007 — Mission Twin as Core Differentiator
Status: ACCEPTED

Mission-level reasoning, counterfactual simulation, and alternatives are core product capabilities.

## D008 — Ecosystem-First Positioning
Status: ACCEPTED

ORCA consumes and orchestrates existing authoritative services instead of claiming to replace them.

## D009 — Pilot Before National Scale
Status: ACCEPTED

Prove one geography deeply before broadening coverage.

## D010 — Official-Source Precedence Hierarchy
Status: ACCEPTED

Decision:
IMD is the supreme authority for severe weather and cyclone alerts. INCOIS is the primary authority for ocean state forecasts and PFZ advisories. Secondary models (Open-Meteo) act strictly as unauthoritative fallback.

Reason:
Maritime safety requires deterministic, legally defensible, and conservative decisions. Under conflicting telemetry, the system always adopts the conservative hazard state.

Impact:
Connectors and risk engine always prioritize official bulletins over secondary models.

## D011 — Provider Status Taxonomy
Status: ACCEPTED

Decision:
Classify every data source under exactly one status: `LIVE`, `LIMITED`, `CACHED_REAL`, `HISTORICAL`, or `MOCK`. Never mark a source as `LIVE` without verified machine-readable execution at runtime.

Reason:
Prevents AI agents and developers from conflating declared endpoints with verified live access.

## D012 — Snapshot Fallback and Provenance Tagging Policy
Status: ACCEPTED

Decision:
In `HYBRID` mode, when a live provider request times out (>3.5s) or fails, the connector falls back to pre-seeded authoritative snapshots, explicitly flags `[SNAPSHOT-FALLBACK]` in warnings, and downgrades derived confidence.

Reason:
Ensures zero-crash resilience during operational connectivity drops while maintaining strict transparency.

## D013 — Pilot Geography Scope (Maharashtra / Konkan Coast)
Status: ACCEPTED

Decision:
Anchor the P0 MVP implementation around Ratnagiri, Malvan, and the Konkan marine corridor (covering active INCOIS PFZ sectors, Malvan Marine Sanctuary, and Goa naval firing sectors).

Reason:
Allows deep, end-to-end multi-source validation across real coastal landing centres before scaling nationally.

## D014 — Single Source of Truth for Sector Surveillance and Zero Operational Frontend Mock Fallbacks
Status: ACCEPTED

Decision:
1. Authority fleet surveillance sectors are authored and stored canonically in the backend synthetic dataset (`sectors.json` / `GET /api/v1/demo/sectors`). The frontend consumes this dynamically; `frontend/src/utils/geo.ts` retains presentation formatters and offline dropdown names only, never maintaining duplicate authoritative geometries.
2. The frontend must never fabricate operational telemetry (vessel coordinates, GPS replay tracks, alert counts, or hazards) in offline mode. If the backend is unreachable or a sector contains zero vessels, the UI displays explicit offline/empty state banners rather than synthetic fallback tracks.
3. All seeded vessels (`vessel-01` to `vessel-08`) have canonical synthetic replay data seeded in `replay_positions.json`, mapping strictly to their home harbors (Ratnagiri: `vessel-01`..`04`; Malvan: `vessel-05`..`08`).

Reason:
Eliminates ghost tracks, false operational telemetry, and hardcoded map locations across surveillance decks.

Impact:
Guarantees end-to-end data integrity from backend synthetic generator to MapLibre viewport.

## D015 — Non-Fabricating Handling of Partial Upstream Payloads in Risk Evaluation
Status: ACCEPTED
Decision:
1. Make `harbor`, `observed_at`, and `valid_to` optional (`Optional[str] = None`) on `MarineConditionsPayload`, `WeatherConditionsPayload`, and `HazardBulletinPayload` rather than required strings.
2. Under no circumstances may missing values be fabricated (no invented harbor names, no current time substituted for missing observation/validity timestamps, no default zero values).
3. In `specialist_tools_node`, dictionary tool results are safely extracted by filtering to declared model fields, safely aliasing compatible keys (e.g. `sea_surface_current_knots` -> `surface_current_knots`), and handling unexpected schema errors gracefully without crashing.
4. Genuinely required safety measurements (e.g. `significant_wave_height_m`) continue to trigger `RecommendationStatus.UNKNOWN` if absent or None, preserving all F02/F03 safety invariants.
5. In `tests/conftest.py`, ensure the shared `tool_registry` baseline starts with contract mocks so test suites are isolated from production connector registration in `main.py`.

Reason:
Upstream connectors, test doubles, and evaluation stubs frequently provide partial observations. Raising uncaught Pydantic `ValidationError` crashed the agent pipeline before deterministic risk evaluation could execute its safety checks.

Impact:
Eliminates crashes on partial marine payloads across agent evaluations while strictly preventing any fabricated data or weakened safety boundaries.
Owner: Dev 2 / Dev 3
Date: 2026-09-13

## D016 — Request-Scoped Authority Chat Sector Context
Status: ACCEPTED

Decision:
Authority chat sends a canonical sector `public_id` in `ChatRequest.user_context.sector_id`. The API validates it against canonical sector data and derives the harbor and coordinates for that request. This explicit request context takes precedence over stored conversation context and client-provided harbor values.

Reason:
An Authority operator can switch sectors while retaining conversation history. The current request must never inherit a previous sector or the Ratnagiri fallback.

Impact:
No global current-sector state is introduced. Existing chats without `sector_id` remain backward compatible; invalid sector IDs are rejected with HTTP 422.

Owner: P0-7 integration
Date: 2026-09-13

## D017 — Canonical Authority Hazard Applicability
Status: ACCEPTED

Decision:
Synthetic hazard provenance contains canonical `affected_sector_ids`. The shared domain resolver selects only `ACTIVE` hazards for a canonical sector. P0-6 situation counts, the sector-hazards API, and the Authority map use that resolver.

Reason:
The prior `/demo/hazards` sector query inferred relevance from display text and IDs, which was neither complete nor safe for map display.

Impact:
No frontend hazard geometry or sector matching is fabricated. Empty results remain distinct from a request failure.

Owner: P0-8A integration
Date: 2026-09-13

## D018 — Observational Vessel-Hazard Containment
Status: ACCEPTED

Decision:
P0-8B uses the latest canonical replay position as current vessel state and
returns an association only when that point is covered by a canonical active
hazard geometry. No proximity buffer, trajectory, or collision implication is used.

Owner: P0-8B integration
Date: 2026-09-13

## D019 — Derived Authority Operational Alerts
Status: ACCEPTED

Decision:
Operational alerts are derived deterministically and request-scoped from P0-8B
`IN_HAZARD_AREA` associations. Their stable ID combines sector, vessel, and
hazard; their severity is copied from the canonical active hazard.

Impact:
No notification table mutation, scheduler, alert lifecycle, risk scoring, or
duplicate records are introduced. Historical broadcast notifications remain
separate from current operational alerts.

Owner: P0-8C integration
Date: 2026-09-13

## D020 — Dedicated Researcher Lab Persona Dashboard & Modular Subdecks
Status: ACCEPTED

Decision:
1. Introduce a third dedicated operational persona in SAMUDRA: `Researcher Lab` (`researcher`), accessible as an independent card from `PortalPage` without altering the existing Fisher or Authority dashboards.
2. The Researcher dashboard is composed of 4 modular decks:
   - `Ocean Data Explorer`: Interactive multi-source marine observation monitoring (wave height, SST, wind, swell, currents) by harbor with historical observation timeline tables, satellite EO grid rasters (Chl-a, SST, cloud cover), PFZ advisory candidates, and active hazard bulletins.
   - `Data Source Monitor`: Live system diagnostics and data provider registry visualizing freshness, operating modes (LIVE, HYBRID, CACHED_REAL, SNAPSHOT), and authoritative precedence hierarchy (IMD -> INCOIS -> Open-Meteo).
   - `Scenario Lab`: Direct interface to the S1–S8 canonical benchmark test suite with individual and batch ("Run All") execution capabilities, KPI telemetry (status, confidence, evidence items, trace steps, execution latency), decisive factors, and warnings.
   - `Query Workbench`: Research-oriented conversational interface featuring pre-configured domain query chips, inline recommendation cards, collapsible inline evidence inspection tables, and agent execution trace timelines.
3. Architecture strictly follows zero-regression principles: Fisher and Authority pages remain untouched, and the researcher client (`researcher-client.ts`) uses graceful fallback to the backend's synthetic demo dataset (`/api/v1/demo/*`) when offline.

Reason:
Empowers marine scientists, oceanographers, and policy analysts to audit source evidence, test risk model sensitivities, and monitor environmental trends without compromising the mission-critical, high-stress interfaces of artisanal fishers and port authorities.

Impact:
Extends SAMUDRA's user taxonomy into research and analytics while keeping the codebase modular and cleanly segregated across personas.
Owner: Dev 1 / Dev 4 (Researcher persona)
Date: 2026-09-13

## Decision template
### D0XX — <title>
Status: PROPOSED / ACCEPTED / REJECTED
Decision:
Reason:
Alternatives:
Impact:
Owner:
Date:
