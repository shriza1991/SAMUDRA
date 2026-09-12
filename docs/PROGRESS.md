# ORCA / SAMUDRA Operational Progress

> Single operational status board. Strictly factual. No diary narrative.

## Current Release & Workstream State
- Current version: `v0.1.0-p0-data-foundation`
- Active branch: `main`
- Current milestone: **P0 Marine Data & API Integration Foundation**
- Completion status: **COMPLETE & OFFLINE VERIFIED**

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

| **M1** | Frontend & UI | READY | MapLayer schema alignment, voice call interface, Fisher/Authority separate pages, single portal switching, header logout button, dynamic MapView with harbor auto-pan & sector surveillance layers, base operational geofences integration, canonical scenario benchmark runner (S1–S8), fleet trajectory replay scrubber & notifications, inline voice audio/TTS listen button, UI decluttering, end-to-end multilingual localization (EN, HI, MR) across all pages, decks, and simulators, modern web standards integration (standard thin scrollbars, text-wrap balancing & orphan prevention, container queries), full shadcn/ui & Tailwind CSS v4 migration across all 24 components (Button, Badge, Card, Dialog, Popover, Tabs, Select, Slider, Textarea, Alert, Separator, Switch, Tooltip) with dual-theme marine palette preservation | Vitest (64 passed) |
| **M2** | Backend Platform & Connectors | OFFLINE_VERIFIED | Harbors loader, INCOIS OSF/PFZ/SVAS, IMD weather/hazard, Open-Meteo fallback, ConnectorManager | pytest connectors & contracts (71 passed) |
| **M3** | Agent Orchestration & Explainability | OFFLINE_VERIFIED | Tool adapters, capability catalog registration, trace & evidence contracts | pytest agent_eval (371 passed) |
| **M4** | Marine, Geo, Risk & Route Domain | OFFLINE_VERIFIED | Deterministic risk engine, Shapely geofence evaluation, PFZ Haversine ranking engine | pytest domain (12 passed) |

---

## Phase Status Summary
- [x] **Phase 0: Baseline Audit & Data Cleansing** (Canonical layout established, duplicate fixtures pruned)
- [x] **Phase 1: Reference Data Loaders** (`harbors.py` typed loaders & indexing verified)
- [x] **Phase 2: P0 Connectors & Fallback Foundation** (INCOIS OSF/PFZ/SVAS, IMD, Pilot GIS, Open-Meteo)
- [ ] **Phase 3: Real Database / PostGIS Integration** (Docker PostgreSQL/PostGIS container deployment)
- [ ] **Phase 4: Mission Twin Simulation Engine** (P1 — Counterfactual evaluation & temporal forecasting)
- [ ] **Phase 5: Vernacular Voice & Audio Pipelines** (P1 — Whisper / Sarvam AI integration)
