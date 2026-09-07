# Dev2 Feature Status Audit

This document tracks the implementation status of prototype-critical Dev2 features.

| Feature | Status Before Implementation | Current Status | Files Proving Status | Missing Behavior / Acceptance Criteria | Owner | Dependencies / Handoffs | Planned Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FastAPI Health Endpoint** | Basic 200 OK | **IMPLEMENTED** | `backend/app/api/v1/routes.py` | Must reflect DB and live connector states | Dev 2 | None | Phase 7 |
| **Scenario Endpoint** | Basic mock | **IMPLEMENTED** | `backend/app/api/v1/routes.py` | Must return available demo scenarios | Dev 2 | None | Phase 1 |
| **Chat Endpoint (`POST /api/v1/chat`)** | HTTP 501 / Missing | **IMPLEMENTED** | `backend/app/api/v1/routes.py`, `backend/app/services/agent_run_service.py` | Thread-pool async execution, proper sanitization | Dev 2 | Requires `run_orca_graph()` (Dev 3) | Phase 1 |
| **ORCAState to ChatResponse Mapping** | None | **IMPLEMENTED** | `backend/app/services/state_mapper.py` | Map request, response, map layers, evidence | Dev 2 | Requires canonical contracts | Phase 1 |
| **Four Dev2 Provider Protocols** | Interfaces only | **IMPLEMENTED** | `backend/app/connectors/base.py`, `connectors/open_meteo.py` | Must implement Marine, Weather, Hazard, PFZ | Dev 2 | Requires Dev 3 interfaces | Phase 3 |
| **Snapshot Providers** | Missing | **IMPLEMENTED** | `backend/app/connectors/snapshot.py` | Read from disk/DB for deterministic execution | Dev 2 | Fixtures from Dev 4 | Phase 2 |
| **LIVE/HYBRID/SNAPSHOT Routing** | Missing | **IMPLEMENTED** | `backend/app/connectors/manager.py` | Mode-aware routing and fallback | Dev 2 | Settings validation | Phase 2 |
| **Open-Meteo Marine/Weather** | Missing | **IMPLEMENTED** | `backend/app/connectors/open_meteo.py` | Real integration, timezone logic, 4s timeout | Dev 2 | Open-Meteo public API | Phase 3 |
| **INCOIS Ocean-State Access** | Missing | **IMPLEMENTED** | `backend/app/connectors/incois.py` | Live integration with HYBRID Open-Meteo fallback | Dev 2 | INCOIS credentials | Phase 3 |
| **IMD Weather/Hazard Access** | Missing | **IMPLEMENTED** | `backend/app/connectors/imd_hazard.py`, `imd_weather.py` | Live integration with HYBRID Open-Meteo fallback | Dev 2 | IMD credentials | Phase 3 |
| **Raw INCOIS PFZ Access** | Missing | **IMPLEMENTED** | `backend/app/connectors/incois.py` | Raw feature retrieval for Dev4 ranking | Dev 2 | Dev 4 ranking handoff | Phase 3 |
| **Provider Tool Registration** | Missing | **IMPLEMENTED** | `backend/app/connectors/registration.py` | Register Dev2 adapters explicitly | Dev 2 | Dev 3 registry boundary | Phase 4 |
| **Connector Validation & Units** | Missing | **IMPLEMENTED** | `backend/app/connectors/base.py` | ISO-8601 UTC, metric conversions | Dev 2 | None | Phase 3 |
| **Timeout, Retry, Caching** | Missing | **IMPLEMENTED** | `backend/app/connectors/base.py` | 4s max timeout, 1 retry for transient errors, TTL | Dev 2 | None | Phase 7 |
| **Conversation Persistence** | Missing | **IMPLEMENTED** | `backend/app/db/repositories.py` | Store ChatRequest/ChatResponse, SQL models | Dev 2 | Memory handoff for Dev 3 | Phase 5 |
| **Run Persistence** | Missing | **IMPLEMENTED** | `backend/app/db/repositories.py` | Track agent runs across RUNNING/COMPLETED/FAILED | Dev 2 | None | Phase 5 |
| **Evidence & Map-Layer Persistence** | Missing | **IMPLEMENTED** | `backend/app/db/repositories.py` | Store features and run evidence securely | Dev 2 | Dev 1 rendering handoff | Phase 5 |
| **Conversation History API** | Missing | **IMPLEMENTED** | `backend/app/api/v1/routes.py` | `GET /api/v1/chat/{id}/history` | Dev 2 | None | Phase 6 |
| **Run & Map-Layer Detail APIs** | Missing | **IMPLEMENTED** | `backend/app/api/v1/routes.py` | `GET /api/v1/runs/{id}`, `GET /api/v1/map/layers/{id}` | Dev 2 | Dev 1 UX integration | Phase 6 |
| **Base-Layer API** | Missing | **IMPLEMENTED** | `backend/app/api/v1/routes.py` | `GET /api/v1/layers/base` | Dev 2 | None | Phase 6 |
| **Dev2 Automated Tests** | None | **IMPLEMENTED** | `tests/integration/test_hardening.py`, `tests/connectors/*` | Test failure scenarios, DB outage, snapshot fallbacks | Dev 2 | None | Phase 7 |
| **Dev2 Documentation** | Missing | **IMPLEMENTED** | `docs/DEV2_BACKEND_ARCHITECTURE.md`, `DEV2_DEV3_PROVIDER_HANDOFF.md` | Ownership, flow, failure architecture | Dev 2 | None | Phase 7 |
| **Deployment / Docker Exclusions** | N/A | **OUT_OF_SCOPE** | `docker-compose.yml` (untouched) | Handled by infrastructure engineers later | DevOps | None | N/A |

### Status Definitions:
- **IMPLEMENTED**: executable code exists and is covered by a passing test.
- **PARTIAL**: some executable code exists, but required behavior or tests are missing.
- **MISSING**: only comments, documentation, placeholders or HTTP 501 behavior exist.
- **BLOCKED**: Dev2’s boundary is finished but external access or another owner’s work is required.
- **OUT_OF_SCOPE**: deployment, Docker, frontend, Dev3 reasoning or Dev4 calculations.
