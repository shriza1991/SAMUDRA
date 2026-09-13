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

| **M1** | Frontend & UI | READY | MapLayer schema alignment, voice call interface, Fisher/Authority separate pages, single portal switching, header logout button, dynamic MapView with harbor auto-pan & sector surveillance layers, base operational geofences integration, canonical scenario benchmark runner (S1–S8), data-driven fleet trajectory replay scrubber & notifications driven by canonical backend dataset (`GET /api/v1/demo/sectors`, `vessels`, `replay`, `notifications`, `hazards`), removal of all fabricated mock telemetry, strict offline banners, full coverage for 8 monitored vessels across Ratnagiri and Malvan, inline voice audio/TTS listen button, UI decluttering, end-to-end multilingual localization (EN, HI, MR) across all pages, decks, and simulators, modern web standards integration (standard thin scrollbars, text-wrap balancing & orphan prevention, container queries), Radix UI/shadcn overlay primitives integration (Dialog, Sheet, Popover for EvidenceDrawer, CallModal, LayerManager), sidebar layout stabilization (eliminated horizontal/vertical overflow, unified single-row tab & context header, resilient 2-row chat card), CallModal design system alignment (replaced hardcoded skeuomorphic dark styles with native theme tokens across Light and Dark modes), header decluttering (removed redundant Call SAMUDRA button from header, anchored exclusively in chat toolbar), dedicated Settings Page (centralized theme toggle, vernacular language cards, operational voyage defaults, voice assistance/VAD parameters, feed diagnostics, seamless two-way portal return routing), authority page decluttering (consolidated dual command and tab bars into unified command bar with segmented pill switcher, removed redundant empty evidence tab and double terminal headers, fully styled S1–S8 Benchmark Runner deck with 2-column layout, spec cards, and live execution audit metrics), Fisher Console CTA text contrast fix (high-contrast white in light mode, dark navy in dark mode), and end-to-end mobile/tablet responsive layout stabilization across portal, fisher, authority, and settings views | Vitest (65 passed) |
| **M2** | Backend Platform & Connectors | OFFLINE_VERIFIED | Harbors loader, INCOIS OSF/PFZ/SVAS, IMD weather/hazard, Open-Meteo fallback, ConnectorManager, P0-3 non-fabricating partial payload contracts | pytest connectors & contracts (71 passed) |
| **M3** | Agent Orchestration & Explainability | OFFLINE_VERIFIED | Tool adapters, capability catalog registration, trace & evidence contracts, P0-2 Benchmark Runner runtime state isolation, P0-3 robust partial payload extraction in specialist_tools_node & conftest contract mock isolation | pytest scenario & isolation (30 passed), agent_eval (47 passed), domain (25 passed) |
| **M4** | Marine, Geo, Risk & Route Domain | OFFLINE_VERIFIED | Deterministic risk engine (with P0-4 time-stable reference clock support for deterministic regression testing), Shapely geofence evaluation, PFZ Haversine ranking engine, Synthetic demo dataset generator with 5 sectors, 14 canonical monitored vessels, and 420 replay positions across Ratnagiri, Malvan, Goa, Mumbai, and Veraval | pytest domain & synthetic (26 passed), observation_bundle (7 passed) |

---

## Phase Status Summary
- [x] **Phase 0: Baseline Audit & Data Cleansing** (Canonical layout established, duplicate fixtures pruned)
- [x] **Phase 1: Reference Data Loaders** (`harbors.py` typed loaders & indexing verified)
- [x] **Phase 2: P0 Connectors & Fallback Foundation** (INCOIS OSF/PFZ/SVAS, IMD, Pilot GIS, Open-Meteo)
- [ ] **Phase 3: Real Database / PostGIS Integration** (Docker PostgreSQL/PostGIS container deployment)
- [ ] **Phase 4: Mission Twin Simulation Engine** (P1 — Counterfactual evaluation & temporal forecasting)
- [ ] **Phase 5: Vernacular Voice & Audio Pipelines** (P1 — Whisper / Sarvam AI integration)
