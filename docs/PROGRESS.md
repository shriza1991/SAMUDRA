# ORCA / SAMUDRA Operational Progress

> Single operational status board. Strictly factual. No diary narrative.

## Current Release & Workstream State
- Current version: `v0.1.0-p0-data-foundation`
- Active branch: `main`
- Current milestone: **P0 Marine Data & API Integration Foundation**
- Completion status: **COMPLETE & OFFLINE VERIFIED**

### P0-7 — Authority chat sector context
- Authority chat now sends the active canonical sector `public_id` per request.
- The chat API validates the sector and derives canonical harbor and coordinates before graph execution.
- Explicit Authority context takes precedence over remembered conversation context; history remains retained and prior-sector responses are not shown as the current sector's active response.

### P0-8A — Authority sector hazards on map
- Canonical active hazard applicability is resolved by sector public ID and shared with P0-6 situation counts.
- The Authority map fetches and renders only the selected sector's canonical GeoJSON hazard layers, clearing them immediately on a sector change or unavailable response.

### P0-8B — Authority vessel-hazard associations
- Authority map highlights only vessels whose latest canonical replay position is inside a selected sector's active canonical hazard geometry.

### P0-8C — Authority operational hazard alerts
- Current, stable operational alerts are derived from P0-8B associations and displayed separately from historical broadcast notifications.

### P0-8D — Authority alert inspection
- Selecting a current operational alert reuses the canonical vessel replay focus and highlights the matching canonical hazard and association geometry. Inspection state is local to the active sector and is cleared on sector switch, unavailable data, or alert reconciliation.

### P0-8E — Authority evidence and audit flow
- Alert inspection opens the existing Audit view with direct canonical containment facts, separately labeled sector-situation evidence, and an explicit unavailable trace when no alert-to-run linkage exists.

### P0-8G — Authority route alternatives & balanced candidate
- Extended canonical RouteExposureEngine to return three truthful, evaluated route candidates: Safety-oriented (`ROUTE-A-INSHORE`), Balanced (`ROUTE-C-BALANCED`), and Direct (`ROUTE-B-DIRECT`).
- Route C follows an intermediate path through the canonical synthetic route graph (`node-01` -> `node-03` -> `node-06` -> `node-10` -> `node-14` -> `node-16`), offering a genuine trade-off (23.4 km, 1.7m max wave, 3.4 exposure) between distance and exposure.
- Exposed route alternatives via `/api/v1/demo/routes/alternatives` and `/api/v1/demo/sectors/{sector_id}/route-alternatives`.
- MissionMapBrief and MapView dynamic layer rendering updated with candidate switching, real metric display, and honest empty/unavailable handling without hardcoded operational route geometry.

### P0-8H — Simultaneous route alternatives visualization without clutter
- Established visual hierarchy for route comparison: selected candidate rendered prominently as solid cyan line (`line_width: 4`, `opacity: 0.95`, `#06b6d4`), while non-selected alternatives render simultaneously as thin, dashed lines (`line_width: 2.5`, `line_dasharray: [3, 3]`, `opacity: 0.50`, `#38bdf8`).
- Integrated dynamic sector route fetching in `AuthorityPage` with request cancellation and stale-state clearing on sector switch.
- Stabilized map camera bounds to prevent abrupt jumping/refitting during Safest / Balanced / Direct corridor switching.

### P0-8J — Region-specific map layer filtering on Fisher & Authority views
- Integrated `filterLayersByRegion` and `filterLayersBySectorPolygon` in `geo.ts` to geographically scope base boundaries and response layers.
- Scoped Fisher page map layers to the active departure harbor region, preventing out-of-region geofences, routes, and hazards from cluttering the local view.
- Scoped Authority page map layers to the active surveillance sector polygon, preventing cross-sector geofence and route leakage.
- Updated `MockRouteExposureEngine` to anchor passage route waypoints dynamically to the active sector or origin harbor coordinates instead of a hardcoded default.
- Resolved in-memory offline store re-entrancy deadlock (`RLock`).

### P0-8K — Authentic Indian EEZ & Island Maritime Boundaries (Mainland, Andaman & Nicobar, Lakshadweep)
- Integrated authentic UNCLOS maritime boundaries from Flanders Marine Institute (VLIZ Marine Regions v12):
  - Mainland & Peninsular EEZ (`POLY-EEZ-IND-MAIN`, 1,659,500 km², MRGID 8480) spanning Arabian Sea and Bay of Bengal down to 8° Channel Maldives treaty line.
  - Andaman & Nicobar Archipelago EEZ (`POLY-EEZ-IND-ANDAMAN`, 664,448 km², MRGID 8333) with full high-resolution boundary arc and international treaty borders (Indonesia, Thailand, Myanmar).
  - Lakshadweep Islands Sovereign Territorial Waters 12 NM (`POLY-TERRITORIAL-LAKSHADWEEP`, MRGID 49194 Part 0) enclosing Minicoy, Kalpeni, Kavaratti, Agatti, Androth, Amini, Kadmat, Kiltan, Chetlat, Bitra, and Suheli atolls.
  - Andaman & Nicobar Sovereign Territorial Waters 12 NM (`POLY-TERRITORIAL-ANDAMAN`, MRGID 49060) enclosing the entire island chain, plus Barren Island and Narcondam Island.
- Exempted national sovereign maritime boundaries from local sector culling in `frontend/src/utils/geo.ts` so India's complete water boundary is always accurately displayed nationwide while keeping local operational geofences (firing ranges, MPAs) scoped to their region.
- Excluded informational national boundaries from deterministic restricted zone hazard checks in `geo_restrictions.py`.
- Added multilingual translation mappings for national water boundary layers in Hindi and Marathi.

### P0-8L — Fleet Surveillance Accurate Route Corridors with Start & Destination Terminals
- Parameterized route alternatives endpoint (`/api/v1/demo/routes/alternatives`) with `vessel_id` to contextualize navigation corridors directly to the active fleet craft.
- Updated `MockRouteExposureEngine` to connect authentic multi-waypoint navigation corridors (Safest Inshore, Balanced, Direct) from the vessel's specific home harbor/departure coordinates to its specific trip destination/fishing bank.
- Dynamically generates start point marker (`layer_route_start_marker`, emerald `#10b981`) and end point marker (`layer_route_end_marker`, amber `#f59e0b`) in `MapView.tsx`.
- Updated `MissionMapBrief.tsx` to extract and display Departure (Start) and Destination (End) names/coordinates directly under corridor metric pills.
- Updated `FleetTrackingDeck.tsx` to surface Start and Destination coordinates and harbor labels in the GPS scrubber telemetry deck.
- Strictly verified and enforced that passage routes never cross inland onto dry land; all alternative corridors (Safest Inshore, Balanced, Direct) across all 14 vessels and general sectors follow authentic, verified in-water channels and clamp coordinates seaward into the Arabian Sea.

### P0-8M — Fleet Surveillance Trajectory Replay Continuous Autoplay & Lifecycle Controls
- Configured GPS trajectory replay to autoplay automatically upon vessel selection and sector load, starting from departure (`currentIndex = 0`, `isPlaying = true`).
- Enhanced ticker animation to continuously trace coastal voyages point-by-point (1s intervals), hold for 2s at the voyage destination to display arrival telemetry, and smoothly loop back to departure.
- Guarded operational alert audits: clicking a vessel hazard alert pauses playback and anchors the camera and vessel marker at the evaluated containment position (`pos.length - 1`).
- Upgraded playback controls: Play button restarts from departure when reaching the end, Reset button rewinds and immediately plays, active vessel card click restarts playback, and manual slider scrubbing pauses playback cleanly.
- Added clean timestamp formatter (`formatTimestamp`) normalizing ISO timestamps into readable `HH:mm` format across UI labels and MapLayer popups.

### P0-8N — Fleet Surveillance Predicted Path Dynamic Yellow Dotted Line
- Configured vessel predicted path (`layer_fleet_estimated_trajectory`) in yellow dotted line (`color: '#facc15'`, `line_width: 3`, `line_dasharray: [0, 2]`) using round line-cap geometry.
- Dynamically generates the predicted path directly ahead of the vessel craft on every step of autoplay and manual scrubbing, projecting both the remaining planned voyage route to destination and the 30-minute dead-reckoning trajectory based on instantaneous speed and heading.
- Updated `MapView.tsx` to compile `line-dasharray` directly into initial line layer paint definitions as well as runtime updates.
- Synchronized layer lifecycle: clearing predicted path on empty vessel telemetry or sector switch, while maintaining active layer on replay autoplay.

---

## P0 Marine Data Providers Status Board

| Provider / Feed | Protocol / Implementation | Data Mode | Status | Tests | Live Verification State | Blocker / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INCOIS OSF** | `MarineConditionsProvider` (`IncoisOceanStateConnector`) | `LIVE` / `HYBRID` / `SNAPSHOT` | `OFFLINE_VERIFIED` | `test_incois.py`, `test_connector_contracts.py` | Requires external `INCOIS_API_KEY`. Normalizes live or falls back to Open-Meteo. | None (Graceful Open-Meteo fallback verified) |
| **INCOIS PFZ** | `PFZSourceDataProvider` (`IncoisOceanStateConnector`, `DeterministicPFZRankingEngine`) | `LIVE` / `HYBRID` / `SNAPSHOT` | `OFFLINE_VERIFIED` | `test_incois.py`, `test_connector_contracts.py` | Authoritative vectors parsed; Haversine & compass bearing calculated deterministically. | None (Deterministic ranking complete) |
| **INCOIS SVAS** | `SVASAdvisoryProvider` (`IncoisOceanStateConnector`, `SnapshotConnector`) | `LIVE` / `HYBRID` / `SNAPSHOT` | `OFFLINE_VERIFIED` | `test_incois.py`, `test_registration.py` | In HYBRID without API key returns `CACHED_REAL` / `LIMITED`. | Live government SVAS portal requires clearance |
| **IMD Coastal Weather** | `WeatherConditionsProvider` (`ImdWeatherConnector`) | `LIVE` / `HYBRID` / `SNAPSHOT` | `OFFLINE_VERIFIED` | `test_imd.py`, `test_connector_contracts.py` | Normalizes live IMD bulletin; fallback to Open-Meteo on failure. | None (Fallback verified) |
| **IMD Cyclone / Hazard** | `HazardBulletinsProvider` (`ImdHazardConnector`) | `LIVE` / `HYBRID` / `SNAPSHOT` | `OFFLINE_VERIFIED` | `test_imd.py`, `test_connector_contracts.py` | Severe hazard / squall warning triggers NO_GO/CAUTION in risk engine. Conservative NORMAL default when live unavailable. | None (Hard-stop compatibility verified) |
| **Pilot GIS Restrictions** | `GeospatialHazardEngine` (`DeterministicGeospatialEngine`) | `CACHED_REAL` | `OFFLINE_VERIFIED` | `test_geospatial.py` | Shapely point-in-polygon and route intersection over Malvan MPA, Goa Naval Range, and Gujarat IMBL buffer. | None (Pure Python Shapely offline) |
| **Open-Meteo Fallback** | `MarineConditionsProvider` & `WeatherConditionsProvider` (`OpenMeteoConnector`) | `LIVE` | `LIVE_VERIFIED` | `test_open_meteo.py` | Public endpoint tested with connection pooling, retries, and bounded timeout. | None (Public access active) |
| **Reference Catalogs** | `load_landing_centres`, `load_vessel_profiles` (`harbors.py`) | Canonical Files | `OFFLINE_VERIFIED` | `test_harbors.py` | Typed Pydantic validation, deterministic name/ID indexing, missing record safety. | None |

---

## Team Ownership Matrix & Status

| **M1** | Frontend & UI | READY | MapLayer schema alignment, voice call interface, Fisher/Authority separate pages, single portal switching, header logout button, dynamic MapView with harbor auto-pan & sector surveillance layers, base operational geofences integration, canonical scenario benchmark runner (S1–S8), data-driven fleet trajectory replay scrubber & notifications driven by canonical backend dataset (`GET /api/v1/demo/sectors`, `vessels`, `replay`, `notifications`, `hazards`), removal of all fabricated mock telemetry, strict offline banners, full coverage for 8 monitored vessels across Ratnagiri and Malvan, inline voice audio/TTS listen button, UI decluttering, end-to-end multilingual localization (EN, HI, MR) across all pages, decks, and simulators, modern web standards integration (standard thin scrollbars, text-wrap balancing & orphan prevention, container queries), Radix UI/shadcn overlay primitives integration (Dialog, Sheet, Popover for EvidenceDrawer, CallModal, LayerManager), sidebar layout stabilization (eliminated horizontal/vertical overflow, unified single-row tab & context header, resilient 2-row chat card), CallModal design system alignment (replaced hardcoded skeuomorphic dark styles with native theme tokens across Light and Dark modes), header decluttering (removed redundant Call SAMUDRA button from header, anchored exclusively in chat toolbar), dedicated Settings Page (centralized theme toggle, vernacular language cards, operational voyage defaults, voice assistance/VAD parameters, feed diagnostics, seamless two-way portal return routing), authority page decluttering (consolidated dual command and tab bars into unified command bar with segmented pill switcher, removed redundant empty evidence tab and double terminal headers, fully styled S1–S8 Benchmark Runner deck with 2-column layout, spec cards, and live execution audit metrics), Fisher Console CTA text contrast fix (high-contrast white in light mode, dark navy in dark mode), end-to-end mobile/tablet responsive layout stabilization across portal, fisher, authority, and settings views, unified 3-column single row layout for Fisher, Authority, and Researcher persona cards on the portal selection page (`max-width: 1320px`, `repeat(3, 1fr)`), dedicated Researcher Lab persona dashboard with 4 modular decks (Ocean Data Explorer, Data Source Monitor, Scenario Lab with S1–S8 benchmark evaluation, and Query Workbench with inline evidence & trace) strictly preserving Fisher and Authority dashboards untouched, hardened with deck error boundaries, resilient backend payload normalization, and multi-day EO cell de-duplication | Vitest (93 passed) |
| **M2** | Backend Platform & Connectors | OFFLINE_VERIFIED | Harbors loader, INCOIS OSF/PFZ/SVAS, IMD weather/hazard, Open-Meteo fallback, ConnectorManager, P0-3 non-fabricating partial payload contracts | pytest connectors & contracts (71 passed) |
| **M3** | Agent Orchestration & Explainability | OFFLINE_VERIFIED | Tool adapters, capability catalog registration, trace & evidence contracts, P0-2 Benchmark Runner runtime state isolation, P0-3 robust partial payload extraction in specialist_tools_node & conftest contract mock isolation | pytest scenario & isolation (30 passed), agent_eval (47 passed), domain (25 passed) |
| **M4** | Marine, Geo, Risk & Route Domain | OFFLINE_VERIFIED | Deterministic risk engine (with P0-4 time-stable reference clock support for deterministic regression testing), Shapely geofence evaluation, PFZ Haversine ranking engine, Synthetic demo dataset generator with 5 sectors, 14 canonical monitored vessels, and 420 replay positions across Ratnagiri, Malvan, Goa, Mumbai, and Veraval, and P0-8G three evaluated route alternatives (Safest, Balanced, Direct) via RouteExposureEngine | pytest domain & synthetic (26 passed), observation_bundle (7 passed), route_balanced (53 passed) |

---

## Phase Status Summary
- [x] **Phase 0: Baseline Audit & Data Cleansing** (Canonical layout established, duplicate fixtures pruned)
- [x] **Phase 1: Reference Data Loaders** (`harbors.py` typed loaders & indexing verified)
- [x] **Phase 2: P0 Connectors & Fallback Foundation** (INCOIS OSF/PFZ/SVAS, IMD, Pilot GIS, Open-Meteo)
- [ ] **Phase 3: Real Database / PostGIS Integration** (Docker PostgreSQL/PostGIS container deployment)
- [ ] **Phase 4: Mission Twin Simulation Engine** (P1 — Counterfactual evaluation & temporal forecasting)
- [ ] **Phase 5: Vernacular Voice & Audio Pipelines** (P1 — Whisper / Sarvam AI integration)
