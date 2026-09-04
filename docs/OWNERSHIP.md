# SAMUDRA Team Ownership & Code Boundary Matrix

> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Rule:** Strict separation of concerns to prevent merge collisions and keep developers moving independently.

---

## 1. Ownership Overview Matrix

| Member | Role | Primary Directory Ownership | Must NEVER Implement |
| :--- | :--- | :--- | :--- |
| **Dev 1** | Frontend & Geospatial UX | `frontend/` | Risk formulas, PFZ algorithms, agent prompts, external connectors |
| **Dev 2** | Backend Platform & Integration | `backend/app/api/`, `backend/app/contracts/`, `backend/app/connectors/`, `backend/app/repositories/`, `backend/app/core/`, migrations, root Docker/configs | LLM prompts, agent routing, risk formulas, PFZ ranking, route scoring |
| **Dev 3** | Agent Orchestration & Explainability | `backend/app/agents/`, `backend/app/prompts/` | Geospatial math, risk thresholds, route scoring, raw HTTP API calls, raw SQL in prompts |
| **Dev 4** | Marine, Geo, Risk & Route Intelligence | `backend/app/domain/`, `backend/app/tools/marine/`, `backend/app/tools/geospatial/`, `data/fixtures/` | FastAPI routes, frontend React code, LLM prompts, direct external HTTP adapters |
| **Member 5** | Domain Research & Validation | Domain validation, `docs/DATA_SOURCES.md`, scientific advisory | Does not write application code directly |
| **Member 6** | QA, Demo & Presentation Lead | `demo/`, test scenario validation, presentation scripts, backup videos | Does not push last-minute feature code |

---

## 2. Detailed Member Responsibilities & Boundaries

### 2.1 DEV 1 — Frontend & Geospatial UX Lead
- **Owned Files**:
  - `frontend/**`
  - `tests/frontend/**`
- **Core Deliverables**:
  - Responsive single-page application (React + Vite + TypeScript).
  - MapLibre GL JS vector map with dynamically rendered GeoJSON layers (PFZ markers, storm sectors, geofence polygons, route lines).
  - Chat interface with quick prompt chips (e.g., "Is it safe from Ratnagiri?", "Nearest PFZ today?").
  - Recommendation status banner (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`, `INFORMATIONAL`).
  - Slide-out Evidence Provenance drawer and high-level Agent Activity timeline.
  - Client-side unit/component tests (Vitest / Testing Library).
- **Hard Boundaries**:
  - Do NOT calculate distances or risk states in JavaScript. Render what `ChatResponse` provides.
  - Do NOT call external weather APIs directly from the browser. All data flows through FastAPI.

---

### 2.2 DEV 2 — Backend Platform & Integration Lead
- **Owned Files**:
  - `backend/app/api/**`
  - `backend/app/contracts/**`
  - `backend/app/connectors/**`
  - `backend/app/repositories/**`
  - `backend/app/core/**`
  - `docker-compose.yml`, `backend/pyproject.toml`, deployment scripts
- **Core Deliverables**:
  - FastAPI application factory, middleware, CORS, rate limits, and lifecycle events.
  - Pydantic v2 shared contract models (`ChatRequest`, `ChatResponse`, `ToolResult`).
  - External source connectors with timeout, retry, and caching (INCOIS, IMD, MOSDAC, Open-Meteo).
  - `DATA_MODE` controller (`LIVE` -> `HYBRID` with snapshot fallback -> `SNAPSHOT`).
  - PostgreSQL / PostGIS connection pooling and repository queries.
  - CI pipeline and test runner orchestration.
- **Hard Boundaries**:
  - Do NOT write prompt templates or alter LangGraph agent nodes.
  - Do NOT implement safety threshold logic or route scoring algorithms (call Dev 4's domain functions).

---

### 2.3 DEV 3 — Agent Orchestration & Explainability Lead
- **Owned Files**:
  - `backend/app/agents/**`
  - `backend/app/prompts/**`
  - `tests/agent_eval/**`
- **Core Deliverables**:
  - LangGraph StateGraph implementation:
    - Intent & locale classification node.
    - Supervisor / Planner node.
    - Tool invocation node.
    - Evidence validation node.
    - Response composer node.
  - Session conversation memory and multi-turn state persistence.
  - Multilingual translation/localization of output responses (Hindi, Marathi, Tamil, English).
  - Sanitized trace event logging (preventing private chain-of-thought exposure).
  - Agent evaluation harness for intent accuracy and response quality.
- **Hard Boundaries**:
  - Do NOT perform math, distance calculations, or spatial intersections in prompts.
  - Do NOT hardcode risk rules in prompt text. Always delegate to Dev 4's deterministic Risk Evaluator.
  - Do NOT perform raw HTTP calls or raw database queries directly from prompt nodes.

---

### 2.4 DEV 4 — Marine, Geo, Risk & Route Intelligence Lead
- **Owned Files**:
  - `backend/app/domain/**`
  - `backend/app/tools/marine/**`
  - `backend/app/tools/geospatial/**`
  - `data/fixtures/**`
  - `tests/domain/**`
- **Core Deliverables**:
  - Deterministic marine tools returning typed `ToolResult`:
    - Geodesic distance and bearing calculations (`pyproj` / Haversine).
    - Potential Fishing Zone (PFZ) candidate ranking relative to origin harbors.
    - Geospatial geofence intersection with maritime polygons (MPAs, naval zones, IMBL) using Shapely.
    - Deterministic Risk Evaluation Engine (evaluating wind, wave height, squall alerts against craft ceilings).
    - Multi-route risk exposure comparison (Green vs. Amber vs. Red paths).
  - Standardized benchmark fixtures for the 8 canonical test scenarios (S1-S8).
- **Hard Boundaries**:
  - Do NOT expose raw REST endpoints or modify API routing.
  - Do NOT write UI code or agent prompt templates.
  - Do NOT make direct network requests inside tools (receive data through Dev 2's connectors).

---

### 2.5 MEMBER 5 — Domain Research & Validation Lead
- **Responsibilities**:
  - Conduct deep research into INCOIS PFZ methodologies, ocean state scales (Beaufort scale, Douglas sea scale), and IMD cyclone categorization.
  - Maintain the official **Data Source Register** in `docs/DATA_SOURCES.md`.
  - Validate ground truth for test fixtures S1 through S8 with authentic marine parameters.
  - Review vernacular terminology (Marathi/Hindi fishing phrases) to ensure cultural and practical authenticity for coastal communities.
  - Compile the problem impact briefing and prepare domain responses for ISRO jury Q&A.
- **Boundary**: No direct modifications to core application code.

---

### 2.6 MEMBER 6 — QA, Demo & Presentation Lead
- **Responsibilities**:
  - Own the `demo/` folder, demo runbooks, and presentation timing (5-minute judge pitch).
  - Lead daily acceptance testing and bug triage across the four canonical journeys.
  - Maintain the offline snapshot backup and fallback video recording.
  - Ensure the demo laptop operates flawlessly in airplane/offline mode (testing `DATA_MODE=SNAPSHOT`).
  - Coordinate team rehearsal and slide deck synchronization.
- **Boundary**: Zero late code changes or feature additions during hackathon crunch hours.
