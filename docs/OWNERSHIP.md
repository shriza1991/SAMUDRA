# ORCA Ownership & Parallel Work Model

## Branch model
- `main` — release-ready production
- `develop` — continuous integration
- `team/frontend` — M1
- `team/backend` — M2
- `team/agents` — M3
- `team/domain` — M4

Flow:
`team/* -> develop -> main`

## M1 — Frontend / Experience
Owns:
- `frontend/**`
- frontend tests
- API client
- map/recommendation/evidence/trace UI
- voice UX
- localization

Does not own:
- risk formulas
- connector implementation
- LangGraph routing
- raw provider calls

## M2 — Backend / Platform / Data
Owns:
- `backend/app/api/**`
- `backend/app/contracts/**`
- `backend/app/connectors/**`
- `backend/app/repositories/**`
- `backend/app/core/**`
- migrations/deployment config

Does not own:
- agent prompts/routing
- domain mathematics
- frontend implementation

## M3 — Agents / AI / Orchestration
Owns:
- `backend/app/agents/**`
- `backend/app/prompts/**`
- LLM provider gateway
- memory orchestration
- planning/intent/localization
- evidence-aware response composition

Does not own:
- geospatial math
- deterministic safety thresholds
- raw external HTTP connectors

## M4 — Marine / GIS / Risk
Owns:
- `backend/app/domain/**`
- `backend/app/tools/**`
- `data/fixtures/**`
- domain/scenario tests

Does not own:
- FastAPI routes
- frontend
- LLM prompt design
- direct external provider adapters

## Shared/coordinated
- docs/API_CONTRACTS.md
- docs/CANONICAL_DATA_CONTRACTS.md
- docs/SAFETY.md
- frontend shared contract types
- root CI/deployment files

Shared change:
1. identify
2. record decision
3. update contract
4. update consumers
5. test
6. merge to develop

No silent cross-workstream modifications.
