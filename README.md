# SAMUDRA

> **Smart Autonomous Marine Understanding, Decision & Risk Assistant**  
> **SIH 2026 Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Organization:** Indian Space Research Organisation (ISRO) / Department of Space  
> **Theme:** Disaster Management  
> **Classification:** 12-Day SIH Functional Prototype (Decision Support)

---

## 🌊 Overview

**SAMUDRA** is a prototype Agentic AI-powered Marine Intelligence Platform. Its purpose is to empower coastal fishermen, marine researchers, vessel operators, and disaster management authorities to query complex ocean conditions in natural language (including Indian vernacular languages like Hindi and Marathi) and receive evidence-backed, geospatial recommendations.

SAMUDRA bridges the gap between sophisticated Earth Observation datasets (ISRO MOSDAC, INCOIS, IMD) and grassroots maritime safety through coordinated AI agents, deterministic geospatial calculations, and transparent provenance tracking.

> [!CAUTION]
> **PROTOTYPE DISCLAIMER**  
> SAMUDRA is a functional academic prototype built for the Smart India Hackathon 2026. It is **NOT** a certified marine navigational aid, SOLAS-compliant safety-of-life system, or official replacement for statutory bulletins issued by IMD, INCOIS, or the Indian Coast Guard.

---

## 🎯 The Four Core MVP Journeys

SAMUDRA is scoped to deliver four canonical, judge-facing user journeys:

1. **Nearest PFZ Discovery**  
   *Query:* *"Where is the nearest Potential Fishing Zone today from Ratnagiri?"*  
   *Outcome:* Ranked PFZ zones, geodesic distance, compass bearing, map marker, source attribution, and validity window.

2. **GO / NO-GO Safety Decision Gate**  
   *Query:* *"Is it safe to leave tomorrow at 6 AM on a motorized boat?"*  
   *Outcome:* Deterministic safety state (`GO` / `CAUTION` / `NO_GO` / `UNKNOWN`), decisive factors, wave/wind evidence, and confidence rating.

3. **Hazard & Maritime Boundary Alerts**  
   *Query:* *"Any cyclone, lightning or restricted-water risk on this trip?"*  
   *Outcome:* Active hazard polygons, geofence intersection with naval or protected zones, and hard-stop alerts.

4. **Safer Alternative Route Comparison**  
   *Query:* *"Which of these routes has the lowest weather and boundary risk?"*  
   *Outcome:* Comparative evaluation of 2–3 candidate routes, exposure scoring, and clear risk tradeoffs.

---

## 🏛️ System Architecture

SAMUDRA is architected as a **Modular Monolith** to maximize development velocity, maintain zero network latency between agent nodes, and guarantee high reliability during hackathon evaluations.

```
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND (React + MapLibre)                 │
│         Chat Interface │ Vector Maps │ Evidence Drawer       │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON REST API
┌──────────────────────────────▼──────────────────────────────┐
│                  FASTAPI APPLICATION BACKEND                │
│                                                             │
│  [ LangGraph Agent Orchestrator ]                           │
│  - Intent & Locale Detection   - Planning & Coordination    │
│  - Response Localization       - Evidence Validation        │
│                                                             │
│  [ Deterministic Domain Engines ] (No LLM in Calculations!)  │
│  - Geodesic Distances          - Shapely Geofencing         │
│  - Deterministic Risk Engine   - Route Exposure Scoring     │
│                                                             │
│  [ Hybrid Ingestion & Storage ]                             │
│  - INCOIS (PFZ & OSF)          - IMD Weather Bulletins      │
│  - MOSDAC Earth Observation    - Open-Meteo Fallback        │
│  - PostGIS Storage             - Validated Snapshot Cache   │
└─────────────────────────────────────────────────────────────┘
```

For complete technical specifications, see [`docs/ARCHITECTURE.md`](file:///c:/Users/dyara/SAMUDRA/docs/ARCHITECTURE.md) and [`docs/AGENT_WORKFLOW.md`](file:///c:/Users/dyara/SAMUDRA/docs/AGENT_WORKFLOW.md).

---

## 🛠️ Technology Stack

| Domain | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, MapLibre GL JS, Vanilla CSS |
| **Backend API** | FastAPI, Pydantic v2, HTTPX, SQLAlchemy |
| **Agent Runtime** | LangGraph, Provider-Agnostic LLM Interface (OpenAI / Anthropic / Gemini / Ollama) |
| **Geospatial & Domain** | PostGIS, Shapely, GeoPandas, PyProj |
| **Data Ingestion** | INCOIS REST/Scraper, IMD Bulletins, MOSDAC, Open-Meteo Marine |
| **Testing** | Pytest, Vitest / React Testing Library, Playwright |
| **DevOps / Local Env**| Docker Compose, PostgreSQL 16 + PostGIS 3.4 |

---

## 🛡️ Core Safety Principles

1. **Deterministic Risk Authority**: LLMs understand context and explain results, but **never calculate risk or distances**. All safety thresholds and geofence intersections run in deterministic Python.
2. **Hard-Stops**: Active IMD Red Alerts or prohibited boundary intersections trigger unconditional `NO_GO` states that the LLM cannot soften.
3. **Stale Data Preclusion**: Stale (>24h) or missing forecast data can never produce a `GO` status.
4. **Evidence-First**: Every numerical fact presented to the user is backed by an `EvidenceItem` with source URLs and validity timestamps.
5. **No Hallucinated Percentages**: Confidence is derived from data freshness and official source availability, not model confidence guesses.

Full details: [`docs/SAFETY.md`](file:///c:/Users/dyara/SAMUDRA/docs/SAFETY.md).

---

## 📁 Repository Directory Structure

```
SAMUDRA/
├── frontend/                   # Dev 1: React + Vite + MapLibre UI
│   ├── src/
│   │   ├── types/              # TypeScript mirror of backend contracts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                    # Python FastAPI application
│   ├── app/
│   │   ├── api/                # Dev 2: REST endpoints (/api/v1/chat, /health)
│   │   ├── contracts/          # Canonical Pydantic schemas (ChatResponse, ToolResult)
│   │   ├── connectors/         # Dev 2: External adapters (INCOIS, IMD, Open-Meteo)
│   │   ├── repositories/       # Dev 2: PostGIS spatial storage
│   │   ├── core/               # Dev 2: Configuration & settings
│   │   ├── agents/             # Dev 3: LangGraph state graph & specialist nodes
│   │   ├── prompts/            # Dev 3: System prompts & localization templates
│   │   ├── domain/             # Dev 4: Deterministic risk engine & route comparison
│   │   └── tools/              # Dev 4: Deterministic marine & geospatial tools
│   │       ├── marine/
│   │       └── geospatial/
│   ├── pyproject.toml
│   └── requirements.txt
│
├── data/
│   └── fixtures/               # Dev 4 & Member 5: S1–S8 benchmark scenarios & GeoJSON
│
├── tests/
│   ├── contract/               # Schema validation tests
│   ├── domain/                 # Deterministic engine unit tests
│   ├── integration/            # FastAPI integration tests
│   └── agent_eval/             # LangGraph evaluation tests
│
├── docs/                       # Comprehensive architectural & process guides
│   ├── ARCHITECTURE.md
│   ├── AGENT_WORKFLOW.md
│   ├── API_CONTRACTS.md
│   ├── OWNERSHIP.md
│   ├── DEVELOPMENT.md
│   ├── DATA_SOURCES.md
│   ├── SAFETY.md
│   ├── TESTING.md
│   ├── DEMO.md
│   └── ROADMAP.md
│
├── demo/                       # Member 6: Presentation scripts & runbooks
├── docker-compose.yml          # PostGIS local service
├── .env.example                # Environment configuration template
├── .gitignore
└── README.md
```

---

## 👥 Team Ownership Matrix

| Member | Role | Primary Focus | Boundary Rules |
| :--- | :--- | :--- | :--- |
| **Dev 1** | Frontend & Geospatial UX | `frontend/` (Chat UI, MapLibre layers, Evidence drawer) | No agent prompts, no risk math |
| **Dev 2** | Backend & Integration | `backend/app/{api,contracts,connectors,core}`, Docker | No LLM prompts, no risk formulas |
| **Dev 3** | Agent Orchestration | `backend/app/{agents,prompts}`, LangGraph, Localization | No geospatial math, no direct DB queries |
| **Dev 4** | Marine / Geo / Risk Engine | `backend/app/{domain,tools}`, `data/fixtures/` | No UI code, no API routes, no LLM prompts |
| **Member 5** | Domain Research & Validation | Data Source Register, ground-truth ocean validation | Scientific accuracy & ISRO alignment |
| **Member 6** | QA & Presentation Lead | `demo/`, acceptance checklist, offline backup | Demo resilience & judge pitch delivery |

Detailed guidelines: [`docs/OWNERSHIP.md`](file:///c:/Users/dyara/SAMUDRA/docs/OWNERSHIP.md) and [`docs/DEVELOPMENT.md`](file:///c:/Users/dyara/SAMUDRA/docs/DEVELOPMENT.md).

---

## 🚀 Quickstart & Scaffolding Setup

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+ and npm

### 1. Environment Setup
```bash
# Clone the repository
git clone https://github.com/shriza1991/SAMUDRA.git
cd SAMUDRA

# Copy the configuration template
cp .env.example .env
```

### 2. Start PostgreSQL + PostGIS
```bash
docker compose up -d db
```

### 3. Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

---

## 📊 Current Status

- **Phase**: Repository Foundation & Team Scaffolding (Day 0)
- **Implemented**: Canonical contracts, directory architecture, PostGIS container, documentation, and development guidelines.
- **Next Step**: Day 1 kickoff — Dev 1-4 begin parallel implementations against contracts.
