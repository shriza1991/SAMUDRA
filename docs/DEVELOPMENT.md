# SAMUDRA Development & Collaboration Guidelines

> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Rule of Engagement:** Fast execution with zero merge conflicts through contract-first boundaries.

---

## 1. Branching & Git Workflow

### 1.1 Branch Naming Convention
All branches branch off `main` and must adhere strictly to member roles:
- `dev1/frontend-chat-ui`
- `dev1/maplibre-geojson-layers`
- `dev2/fastapi-app-scaffold`
- `dev2/connectors-incois-imd`
- `dev3/langgraph-supervisor-graph`
- `dev3/prompt-composition-locale`
- `dev4/domain-pfz-ranking`
- `dev4/deterministic-risk-engine`
- `qa/demo-scenarios-verification`

### 1.2 The Single-Writer Rule
To eliminate merge conflicts during the 12-day build:
- **No two developers may touch the same file in the same PR.**
- Respect the directories established in [`docs/OWNERSHIP.md`](file:///c:/Users/dyara/SAMUDRA/docs/OWNERSHIP.md).
- If Dev 3 needs a new function from Dev 4, Dev 4 defines the typed interface and merges it first; Dev 3 then imports it.

---

## 2. Contract-First Development Protocol

All features start with **Contracts**, located in:
- Python: `backend/app/contracts/`
- TypeScript: `frontend/src/types/contracts.ts`

### Changing an Interface:
1. **Never change a contract unilaterally.**
2. If an adjustment is required (e.g. adding a new field to `ChatResponse` or `ToolResult`):
   - Developer opens a short discussion with Dev 1, Dev 2, and Dev 3.
   - Update `docs/API_CONTRACTS.md`.
   - Update both Pydantic schemas and TypeScript definitions simultaneously.
   - Run `pytest tests/contract/` to verify schema parity.

---

## 3. Daily Integration Cadence

In a 12-day hackathon, long-lived branches are fatal.
- **Daily Trunk Synchronization**: Every developer re俠bases or merges `main` into their feature branch at the start and end of every day.
- **Evening Integration Check (21:00 IST)**:
  - All merged PRs must pass `pytest tests/integration/`.
  - Frontend must build with zero TypeScript errors (`npm run build`).
  - Docker Compose must spin up without crashed containers.

---

## 4. Testing Expectations

Before opening a PR:
1. **Backend Unit & Contract Tests**:
   ```bash
   pytest tests/contract/ tests/domain/
   ```
2. **Frontend Type Check & Linter**:
   ```bash
   cd frontend && npm run typecheck
   ```
3. **No Mocks masquerading as Real Logic**:
   - Write clear deterministic logic or explicit snapshot loaders.
   - Do NOT commit dummy hardcoded values inside production routes.

---

## 5. Environment & Secrets Management
- Always maintain `.env.example` when adding a new configuration variable.
- Never commit `.env` containing real keys.
- Use `DATA_MODE=SNAPSHOT` for unit tests and offline testing.
