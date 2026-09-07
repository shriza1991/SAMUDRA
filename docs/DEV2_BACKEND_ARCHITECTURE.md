# Dev2 Backend Architecture

## 1. Dev2 System Boundary
Dev2 owns the Backend Platform, integration with external APIs, Database Persistence, and FastAPI infrastructure. Dev2 is strictly bounded to data-fetching and persistence operations.
Dev2 **does not** own prompt templates, agent graphs, geospatial math, risk thresholds, or frontend interfaces. Dev2 delivers data precisely mapped to the schemas Dev3 and Dev4 depend on.

## 2. Request and Data Flow
1. **Client** issues `POST /api/v1/chat`.
2. **FastAPI Route** passes the request to `AgentRunService`.
3. `AgentRunService` creates a `Run` record in the DB and dispatches the LangGraph execution (`run_orca_graph`) into an `anyio` thread pool to prevent blocking the async loop.
4. **Dev3 Graph** executes, invoking registered Dev2 providers for data (e.g., `marine_conditions`).
5. **ConnectorManager** intercepts the tool request and checks the active `DATA_MODE`.
6. Depending on the mode, the request routes to a live `BaseLiveConnector` (using `httpx`), or fetches a fixture via `SnapshotConnector` (from DB or disk).
7. Providers return strictly typed canonical payloads (e.g., `MarineConditionsPayload`).
8. The graph completes, mapping output via `state_mapper.py` into a canonical `ChatResponse`.
9. The run, evidence, map layers, and traces are persisted to PostgreSQL/PostGIS.
10. The client receives the deterministic `ChatResponse`.

## 3. Component Responsibilities
- **API & Routes**: Manage inbound HTTP connections, lifecycle events, and REST definitions.
- **Middleware**: Impose request size limits, CORS policies, and Request-ID tagging for observability.
- **Connectors**: `BaseLiveConnector` handles outbound HTTP requests, 1-retry transients, timeouts, and cache TTL. `ConnectorManager` handles fallback and tracking.
- **Repositories**: SQLAlchemy classes (`RunRepository`, `EvidenceRepository`) encapsulate SQL transactions and map Python entities to PostGIS tables.
- **AgentRunService**: The non-blocking thread dispatcher ensuring sync graphs play well with async FastAPI.

## 4. Connection with Dev3 and Dev4
- **Dev3 (Agent)**: Dev2 registers tool adapters (like `marine_conditions`) at startup into Dev3's `ToolRegistry`. Dev3’s prompts consume the deterministic JSON emitted by Dev2.
- **Dev4 (Domain)**: Dev2 fetches raw features (like raw INCOIS PFZ geometries) but never ranks or filters them. The raw payloads are passed to Dev4 tools, which handle all geospatial ranking and intersections.

## 5. Source Provenance Rules
- Live data from Open-Meteo is explicitly tagged as Open-Meteo.
- Failed INCOIS/IMD fetches append `[HYBRID Fallback]` or `[DEGRADED]` provenance tags.
- Snapshot fixtures retain their explicit offline source name.
- No artificial measurements or fake safety thresholds are ever invented by Dev2 connectors.

## 6. Failure and Fallback Architecture
- **Timeouts**: Max 4 seconds.
- **Live Failures (502, 503, 504)**: Up to 1 retry.
- **HYBRID Mode**: Transients result in a fallback to deterministic snapshots.
- **Permanent Errors (401, 403, malformed JSON)**: Escalate immediately up the chain and are caught by route exception handlers, sanitized into a `Dev2ErrorEnvelope` ensuring no raw provider details are leaked.
- **Agent Crash**: Results in a safe, generic `ChatResponse` marked with `[DEV2-AGENT-ERROR]` and an `UNKNOWN` recommendation state, ensuring the mariner does not sail on a broken response.

## 7. What Remains Outside Dev2
- **Deployment**: Dockerfiles, GitHub Actions, AWS/GCP configs, Nginx reverse proxies.
- **Geospatial Math**: Haversine distance, Shapely intersections, bounding box logic.
- **LLM Reasoning**: Prompt engineering, context window management, language translation.
- **Frontend**: React components, MapLibre rendering, state management.
