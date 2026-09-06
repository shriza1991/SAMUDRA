**SMART INDIA HACKATHON 2026**

**ORCA**

**Marine EcOsystem Reasoning with Collaborative Agents**

**10-12 Day Functional Prototype Implementation Playbook**

A conflict-free execution plan for four developers in a six-member SIH team

| **Plan field** | **Decision** |
| --- | --- |
| Problem statement | PS 26176 - ISRO / Department of Space |
| Prototype window | 12 calendar days; core feature freeze on Day 9 |
| Development team | 4 developers with strict module ownership |
| Support team | 2 members for research, validation, demo and presentation |
| Default pilot | Maharashtra coast - one landing centre and a bounded offshore demo area |
| Delivery posture | Web prototype, hybrid live/snapshot data, evidence-first recommendations |

|  |
| --- |
| **Sprint outcome:** A judge can ask a natural-language marine question, watch specialized agents collaborate, inspect the supporting evidence, see the answer on a map, and reproduce the same demo even if a public data source is unavailable. |

**Prototype only - not an operational marine-navigation or life-safety system.**

*Prepared 4 September 2026*

# 1. Executive delivery decision

|  |
| --- |
| **Recommended build strategy:** Build one modular monolith with a graph-based agent runtime and deterministic marine/geospatial tools. Do not build separate microservices or a free-form swarm. Deliver a thin end-to-end slice by the end of Day 2, then deepen each capability behind frozen contracts. |

## What the MVP must prove

* Natural-language entry: English, Hindi and Marathi queries; the final response stays in the user's language.
* Contextual conversation: location, time window and vessel/profile context persist across follow-up questions.
* Agent collaboration: the supervisor decomposes a request and invokes at least two relevant specialists for complex questions.
* Multi-source reasoning: at least three sources can be correlated in one safety or route answer.
* Geospatial result: the map displays the user/landing centre, PFZ candidates, hazards/geofences and route alternatives as GeoJSON layers.
* Actionable output: every answer returns GO, CAUTION, NO\_GO, UNKNOWN or INFORMATIONAL, plus reasons, confidence and next action.
* Evidence and freshness: each factual observation shows its source, valid time and warning if stale, missing or substituted.
* Reproducible demo: live, hybrid and snapshot data modes make the prototype usable during API failure or poor internet.

## Four judge-ready user journeys

| **Journey** | **Example question** | **Visible proof** |
| --- | --- | --- |
| Nearest PFZ | Where is the nearest PFZ today from Ratnagiri? | Ranked zone, distance/direction, map marker, source and validity. |
| Go / no-go | Is it safe to leave tomorrow at 6 AM? | Risk band, decisive factors, weather/sea evidence and uncertainty. |
| Hazard and boundary | Any cyclone, lightning or restricted-water risk on this trip? | Alert card, geofence intersection and conservative rule outcome. |
| Safer route | Which of these routes has the lowest weather and boundary risk? | Two or three candidates, exposure comparison and explained recommendation. |

## Hard scope limits

* One coastal pilot sector, not all of India. Expand only after all acceptance gates pass.
* Use authoritative advisories as evidence; do not train a new PFZ or weather model in this sprint.
* Route output is a prototype risk comparison, not certified navigation guidance.
* No production RBAC, payments, blockchain, Kubernetes, native mobile app or real-time AIS integration in the MVP.
* No claim of operational safety. When critical information is absent or stale, the answer must become UNKNOWN or CAUTION, never an invented GO.

# 2. Target prototype architecture

The architecture is logically separated for ownership, but deployed as one frontend and one backend to keep integration and debugging manageable in a 12-day sprint.

![ORCA prototype architecture showing the web interface, FastAPI backend, bounded agent graph, deterministic marine and geospatial tools, data adapters, PostGIS storage, and an evidence-backed response flow.](data:image/png;base64...)

*Figure 1. ORCA prototype architecture and evidence flow.*

## Architecture decisions that protect the schedule

| **Decision** | **Implementation** | **Why it matters in 12 days** |
| --- | --- | --- |
| Modular monolith | React web app + one FastAPI service + PostgreSQL/PostGIS; Docker Compose locally. | One deploy path, clear module boundaries, fewer distributed-system failures. |
| Bounded agent graph | LangGraph supervisor with typed state and explicit nodes; one shared model provider wrapper. | Shows real planning/collaboration without paying the complexity cost of many independent bots. |
| Deterministic safety core | Risk, distance, geofence and route calculations are pure tools outside the LLM. | Repeatable results; the model explains data but cannot overwrite hard safety rules. |
| Adapter-based data | Each source implements the same connector interface and can switch to a recorded snapshot. | External access, throttling or outage does not kill the demo. |
| Evidence envelope | Every tool returns value + source + valid time + geometry + warnings. | Stops unsupported numerical claims and makes answers judge-verifiable. |

## Recommended implementation stack

| **Layer** | **MVP choice** | **Use** |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript, MapLibre GL JS | Chat workspace, layer controls, popups, evidence cards and route comparison. |
| Backend | FastAPI, Pydantic, HTTPX, SQLAlchemy | Typed API, async source calls, validation and persistence. |
| Agent runtime | LangGraph + provider-agnostic LLM client | Stateful plan/execute/validate/synthesize workflow and multi-turn memory. |
| Geospatial | PostgreSQL/PostGIS, Shapely, GeoPandas; Rasterio only if raster overlay is kept | Distance, point-in-polygon, route exposure and data normalization. |
| Reliability | In-process TTL cache for MVP; Redis only as a buffer feature | Freshness-bound responses without another mandatory service. |
| Testing | Pytest, Vitest/React Testing Library, one Playwright happy path | Fast module feedback plus an end-to-end demo gate. |

# 3. Agentic workflow and contracts

|  |
| --- |
| **Agentic principle:** Use the LLM for intent, planning, clarification and explanation. Use deterministic tools for measurements, risk classification, geofence checks and route scoring. This is an agent system because it chooses and coordinates tools from context - not because every step is another chatbot. |

## Runtime graph

1. Normalize the message, detect language, resolve location and time, and ask one clarification if a critical field is missing.
2. Classify intent into PFZ, safety, conditions, hazard, route, productivity/explanation or unsupported.
3. Create a small task plan listing required observations and tools. Independent tasks run in parallel.
4. Specialist nodes call allowlisted tools through typed interfaces; they never scrape arbitrary URLs or invent source values.
5. The deterministic risk gate evaluates freshness, hard alerts, geofence violations and the configured risk matrix.
6. The evidence validator rejects unsupported numeric claims and downgrades confidence when sources fail or disagree.
7. The response composer translates only after facts are locked and returns answer, recommendation, evidence, map layers and safe follow-ups.
8. The backend persists a high-level trace: planned tasks, tools called, status, duration and evidence IDs. Do not expose private chain-of-thought.

## Specialized nodes

| **Node / agent** | **Type and responsibility** | **Output** | **Owner** |
| --- | --- | --- | --- |
| Intent and locale | LLM + rules. Detects user goal/language; extracts place, time and vessel context. | Resolved query or clarification | Dev 3 |
| Supervisor / planner | LLM. Chooses the minimum required agents and parallelizes independent tasks. | Typed task plan | Dev 3 |
| Marine / PFZ | Tool node. Retrieves PFZ evidence and ranks candidates relative to origin. | PFZCandidate[] | Dev 4 tools; Dev 3 node |
| Weather / hazard | Tool node. Fetches forecast/advisories and normalizes severity/freshness. | Observation[] / Advisory[] | Dev 2 adapter; Dev 3 node |
| Geospatial / route | Deterministic tool node. Measures distance, intersects polygons and scores candidate exposure. | RouteCandidate[] | Dev 4 |
| Risk evaluator | Deterministic policy. Hard-stop rules override model wording. | RiskAssessment | Dev 4 |
| Evidence validator | Rules. Confirms source/time coverage and claim support before synthesis. | Validated evidence bundle | Dev 3 |
| Response composer | LLM. Produces concise answer and high-level reasons in the user's language. | ChatResponse | Dev 3 |

## Shared run state

|  |
| --- |
| ORCAState = {  request\_id, thread\_id, language, user\_profile, location, time\_window,  intent, missing\_fields, task\_plan, observations, advisories, pfz\_candidates,  route\_candidates, risk\_assessment, evidence, warnings, confidence,  response, map\_layers, trace } |

## Non-negotiable tool-result contract

|  |
| --- |
| ToolResult = {  status: 'ok' | 'partial' | 'failed',  data: {...}, evidence: [{evidence\_id, source\_name, source\_url,  observed\_at, valid\_from, valid\_to, retrieved\_at, geometry, quality\_flags}],  warnings: [...], error\_code: null | string } |

*The model receives only normalized ToolResult objects. Raw HTML, unknown documents and third-party text are treated as untrusted data, not instructions.*

# 4. Data, reasoning and fallback strategy

## Pilot and data-mode decision

Default to one Maharashtra landing centre and a bounded offshore polygon. The exact centre can change on Day 1, but the bounding box must then be frozen so every fixture, geofence and route test uses the same coordinate reference and timezone.

| **Mode** | **Behaviour** | **Use** |
| --- | --- | --- |
| live | Only current connectors; failures are visible and no fixture substitution occurs. | Developer verification and source diagnostics. |
| hybrid | Try live with timeout; fall back to the latest approved snapshot and label the substitution. | Default staging and normal presentation. |
| snapshot | Use versioned local fixtures with fixed timestamps and expected outputs. | Guaranteed demo, automated tests and backup video. |

## Source shortlist and access plan

| **Need** | **Candidate source** | **12-day implementation** |
| --- | --- | --- |
| PFZ | INCOIS PFZ advisory/map | Use current advisory when machine-readable access is stable; otherwise normalize one approved advisory to GeoJSON with its original validity and URL. |
| Sea state | INCOIS Ocean State Forecast | Preferred official context for waves, winds and currents; validate access and format on Day 1. |
| Warnings | IMD API platform | Use fishermen/marine/cyclone/lightning endpoints if access is granted; maintain a clearly labelled warning snapshot. |
| EO context | MOSDAC / Oceansat | Use one downloaded SST/chlorophyll sample layer for visual and analytical context; do not promise automated national ingestion. |
| Wave fallback | Open-Meteo Marine API | Use an adapter for forecast wave variables when official source access is unavailable; show provider and forecast time. |
| Geofences | Curated demo GeoJSON | Keep simplified restricted/boundary/MPA polygons versioned and visibly labelled as prototype fixtures. |

|  |
| --- |
| **Day 1 kill-switch:** If a source needs registration, IP whitelisting, a manual portal workflow or a fragile scrape, stop integration after two hours. Preserve the connector interface and switch that source to an approved snapshot. The prototype should demonstrate reasoning, not burn the sprint on access negotiation. |

## Reasoning rules

* Risk states are GO, CAUTION, NO\_GO and UNKNOWN. An active severe official warning or prohibited-geofence intersection is a hard stop.
* Missing or stale critical fields can never produce GO. Freshness policy is configuration, not prompt text.
* Confidence is calculated from source availability, freshness, spatial/temporal coverage and agreement; the LLM cannot choose an arbitrary percentage.
* Nearest PFZ is computed geospatially from the selected origin. Suitability context may explain SST/chlorophyll, but must not invent a fishing guarantee.
* The MVP route engine compares two or three bounded candidate corridors using distance, hazard exposure and geofence penalties. Full marine navigation is deferred.
* All thresholds live in versioned configuration and are labelled demonstration thresholds until reviewed by a domain mentor.

## Role boundaries at a glance

| **Role** | **Owns** | **Consumes** | **Produces** |
| --- | --- | --- | --- |
| Dev 1 - UX | React UI, map and frontend tests | ChatResponse, trace and GeoJSON | Judge-facing workspace and E2E proof |
| Dev 2 - Platform | API, contracts, connectors, store and release | Agent graph and domain tool outputs | Typed data, endpoints and reliable deploy |
| Dev 3 - Agents | Graph, prompts, memory and evidence validation | Adapters and deterministic tools | Plan, response and audit trace |
| Dev 4 - Intelligence | PFZ, risk, geospatial, route and fixtures | Normalized observations/advisories | Typed facts, factors and geometries |

# 5. Developer 1 - Frontend and Geospatial UX

|  |
| --- |
| **Mission:** Make agent collaboration and marine evidence understandable in one judge-friendly web workspace. |

## **Owns**

* All code under frontend/, including UI state, components, map rendering and frontend tests.
* Visual contract consumption in frontend/src/types/ and one adapter that maps the backend ChatResponse to UI view models.
* Responsive behaviour for a 1366 x 768 laptop demo and a basic mobile-width fallback.

## **Must deliver**

* Chat panel with sample prompts, conversation history, clarification prompts and loading/error states.
* MapLibre map with independent GeoJSON layers for origin, PFZ, hazards/geofences and route candidates; popups show source and valid time.
* Recommendation banner for GO/CAUTION/NO\_GO/UNKNOWN, factor cards, confidence/freshness indicators and an evidence drawer.
* High-level agent activity timeline using trace events returned by the backend; do not fabricate fake agents in the UI.
* English/Hindi/Marathi rendering, language selector, accessible colours, keyboard-visible controls and empty/stale-data states.
* One Playwright happy path that covers query -> response -> map layer -> evidence drawer.

## **Must not do**

* Do not call INCOIS, IMD, MOSDAC, Open-Meteo or the LLM directly from the browser.
* Do not implement or change risk thresholds, distance formulas, agent prompts or source-normalization logic.
* Do not silently change JSON field names. Request contract changes through Dev 2 before coding against them.
* Do not build native mobile, heavy 3D oceans, authentication flows or unrelated dashboards during the MVP.

## **Required handoffs**

* Consumes the versioned OpenAPI schema and JSON examples owned by Dev 2.
* Gives Dev 2 a list of required UI fields by Day 1 and screenshots/video of each completed journey.
* Pairs with Dev 3 only on trace wording and with Dev 4 only on map-layer semantics, never on their source files.

## **Definition of done**

* Every valid ChatResponse renders without conditional hard-coded demo content.
* Point, line and polygon GeoJSON render correctly and can be toggled independently.
* A backend partial/failure response remains understandable and never leaves a blank screen.
* No console errors in the four canonical journeys; the demo works in hybrid and snapshot modes.

# 6. Developer 2 - Backend Platform, Data Connectors and Integration

|  |
| --- |
| **Mission:** Provide the stable contract and reliability layer connecting the UI, agent graph, deterministic tools and external marine sources. |

## **Owns**

* backend/app/api/, backend/app/contracts/, backend/app/connectors/, backend/app/repositories/, migrations, configuration and deployment files.
* OpenAPI/JSON contract custody, release integration, environment configuration, structured logs and run persistence.
* Connector transport concerns: authentication, HTTP timeouts, retries, caching, source snapshots and normalization plumbing.

## **Must deliver**

* FastAPI endpoints: GET /health, POST /api/v1/chat, GET /api/v1/runs/{id}, GET /api/v1/map/layers/{id}, and GET /api/v1/demo-scenarios.
* Pydantic request/response models, standard error envelope, correlation ID and API examples committed on Day 1.
* SourceAdapter interface plus live/hybrid/snapshot selection. At minimum, one live forecast adapter and versioned snapshots for the other critical feeds.
* PostgreSQL/PostGIS schema for conversations, runs, evidence metadata and geometries; in-memory repository is allowed for Day 2 only.
* Timeout, retry and TTL policy; secrets stay server-side; logs never contain full user location history or API keys.
* Docker Compose/local startup, staging deployment, seed command, health checks and a one-command demo reset.

## **Must not do**

* Do not write LLM prompts, routing decisions, risk formulas, PFZ ranking or route-scoring algorithms.
* Do not change frontend components or render map layers.
* Do not scrape a blocked source indefinitely. Enforce the Day 1 kill-switch and provide a snapshot adapter.
* Do not merge a contract-breaking change without Dev 1, Dev 3 and Dev 4 review.

## **Required handoffs**

* Publishes contract version v1 and sample success/partial/failure payloads before other modules depend on the API.
* Exposes typed SourceAdapter and repository interfaces consumed by Dev 3 and Dev 4.
* Acts as integration/release owner: merges twice daily after tests, tags release candidates and maintains the deployment runbook.

## **Definition of done**

* All endpoints validate inputs and return one standard envelope with evidence timestamps and error codes.
* Each connector passes recorded-response tests and can be replaced by a fixture without changing consumers.
* The system boots from a clean checkout with documented environment variables and seed data.
* A source timeout produces a bounded partial result within the demo latency budget instead of hanging the run.

# 7. Developer 3 - Agent Orchestration, Conversation and Explainability

|  |
| --- |
| **Mission:** Implement a bounded collaborative-agent graph that chooses the right tools, preserves context and produces evidence-supported answers. |

## **Owns**

* backend/app/agents/, backend/app/prompts/, the LLM provider wrapper, agent-state schema mapping and agent evaluation fixtures.
* Supervisor/planner, intent/locale node, specialist tool nodes, evidence validator, response composer and high-level trace events.
* Conversation memory policy and prompt/security guardrails.

## **Must deliver**

* LangGraph state machine with explicit entry, conditional routing, parallel domain tasks, retry/fallback edges and terminal validation.
* Intent extraction for PFZ, safety, conditions, hazards, route and analytical explanation; one targeted clarification for missing critical context.
* Tool registry that calls only typed functions from Dev 2/4 and records inputs, status, duration and evidence IDs.
* Multi-turn memory by thread ID so follow-ups such as 'What about tomorrow morning?' resolve correctly.
* English/Hindi/Marathi same-language response, with translation performed after structured facts and risk state are fixed.
* Evidence-bound synthesis, prompt-injection resistance, unsupported-query handling and a 20-query evaluation set.

## **Must not do**

* Do not perform raw HTTP calls, parse third-party payloads or access the database directly from prompts/nodes.
* Do not implement geodesic math, point-in-polygon, risk thresholds or route scoring inside LLM instructions.
* Do not expose raw chain-of-thought. Return concise plan/tool/result summaries suitable for an audit timeline.
* Do not create a separate LLM instance for every agent unless measurements prove it is needed.

## **Required handoffs**

* Consumes SourceAdapter/tool schemas and never assumes undocumented fields.
* Publishes the exact tool-call specification and trace-event vocabulary to Dev 1/2 by Day 3.
* Escalates data-quality or domain-rule gaps to Dev 4 instead of compensating with prompt wording.

## **Definition of done**

* Each canonical query selects the expected agents and terminates without loops.
* Every numerical statement in the final response maps to an evidence ID or is omitted.
* Critical tool failure changes confidence/status transparently; it never yields an unsupported safe recommendation.
* The evaluation suite checks intent, required tools, language match, evidence completeness and safety override compliance.

# 8. Developer 4 - Marine, Geospatial, Risk and Route Intelligence

|  |
| --- |
| **Mission:** Turn normalized observations and geospatial layers into deterministic, testable marine decisions that agents can call as tools. |

## **Owns**

* backend/app/domain/, backend/app/tools/marine/, backend/app/tools/geospatial/, risk-rules configuration and data/fixtures/.
* Pure domain functions, GeoJSON semantics, approved pilot fixtures and golden expected results.
* Algorithm documentation, unit tests and domain limitation notes.

## **Must deliver**

* Coordinate/time normalization and geometry validation for point, line and polygon inputs.
* Nearest-PFZ ranking by origin, distance/direction calculation and optional SST/chlorophyll context sampling.
* Risk engine with configurable freshness, advisory and environmental rules producing factor-level explanations.
* Geofence proximity/intersection and a conservative hard-stop result for prohibited polygons.
* Prototype route comparison: generate/accept two or three candidate corridors, sample hazards along them, and score distance plus exposure plus geofence penalty.
* At least eight deterministic scenario fixtures covering safe, caution, no-go, unknown, nearest PFZ, boundary intersection, safer alternative and stale data.

## **Must not do**

* Do not create FastAPI routes, persistence code, external HTTP adapters, LLM prompts or frontend map components.
* Do not silently choose operational safety limits. Keep demo thresholds in configuration with source/reviewer notes.
* Do not attempt nationwide raster processing, custom model training or production navigation in this sprint.
* Do not return prose as the primary tool result; return typed facts, factors, geometries and evidence references.

## **Required handoffs**

* Publishes pure-function signatures and example outputs to Dev 3 before implementation is complete.
* Requests normalized observations/repository methods from Dev 2; does not edit connector or repository modules.
* Defines the map-layer meaning and styling metadata consumed by Dev 1, without touching UI code.

## **Definition of done**

* Repeated input produces the same risk status, score factors, PFZ rank and route ranking.
* Geometry tests cover wrong coordinate order, empty geometry, boundary touch, timezone conversion and route crossing.
* No-go and unknown rules override all favourable factors and are visible in output reasons.
* Each scenario includes expected structured output so end-to-end regressions are immediately detectable.

# 9. Ownership matrix and the other two team members

|  |
| --- |
| **Single-writer rule:** Only the accountable owner edits a module during the sprint. Other developers request changes through an interface issue or a small reviewed PR. Dev 2 is the contract and release custodian; this does not give Dev 2 ownership of agent or domain logic. |

| **Work product** | **Accountable owner** | **Required reviewers** | **No direct edits by** |
| --- | --- | --- | --- |
| Frontend screens and map | Dev 1 | Dev 3 for trace; Dev 4 for layer meaning | Dev 2/3/4 |
| API/OpenAPI contracts | Dev 2 | Dev 1, Dev 3, Dev 4 | Dev 1/3/4 |
| External connectors and cache | Dev 2 | Dev 4 for data semantics | Dev 1/3/4 |
| Agent graph and prompts | Dev 3 | Dev 2 for interface; Dev 4 for claims | Dev 1/2/4 |
| Risk/PFZ/geospatial/route tools | Dev 4 | Dev 2 for data; Dev 3 for tool schema | Dev 1/2/3 |
| Deployment and release tags | Dev 2 | All developers | Anyone without release approval |
| Demo script and pitch assets | Members 5 and 6 | All developers for accuracy | Developers during feature hours |

## Member 5 - Domain research and validation lead

* Confirm the pilot landing centre, stakeholder persona and four canonical questions with a mentor/domain reviewer.
* Maintain the source register: access method, licence/attribution, valid time, screenshot, sample payload and known limitation.
* Write expected human answers for the eight fixtures and review whether the system explanation matches the evidence.
* Prepare problem/impact slides and judge questions; do not modify core code or change thresholds informally.

## Member 6 - QA, demo and presentation lead

* Own the acceptance checklist, daily bug triage board and severity labels; reproduce before assigning a defect.
* Run the demo on the actual presentation laptop/network, maintain the snapshot-mode backup and record a two-minute fallback video.
* Validate Hindi/Marathi wording with a fluent reviewer and flag unsafe or overconfident copy.
* Own the five-minute demo narrative, speaker handoffs and judge Q&A; do not merge code or add late features.

## Mandatory handoff contracts

| **Handoff** | **Due** | **Artifact** | **Acceptance** |
| --- | --- | --- | --- |
| Dev 2 -> all | Day 1 | OpenAPI v1 + success/partial/error examples | Each owner signs off field names before implementation. |
| Dev 4 -> Dev 3 | Day 2 | Pure tool signatures + fixture outputs | Agent graph can call stubs with no domain imports. |
| Dev 3 -> Dev 1/2 | Day 3 | Trace event and ChatResponse mapping | UI renders real steps; backend persists same events. |
| Dev 2 -> Dev 4 | Day 3 | Normalized observation/advisory models | Domain tools need no source-specific conditionals. |
| All -> Member 6 | Daily | Deploy link, change log, known issues | One reproducible test path per completed feature. |

|  |
| --- |
| **If the team has only 10 days:** Merge Day 7 into Day 6 and Day 8 into Day 7; use Day 8 for freeze/deploy and Days 9-10 for QA, judge-proofing and final release. Keep every core gate and remove all buffer features - never delete the evidence or snapshot fallback work. |

## Interface change protocol

1. The requesting owner opens a one-paragraph interface issue with the reason, old/new schema and affected journey.
2. All affected owners approve the field meaning and failure behaviour before implementation begins.
3. Dev 2 versions the shared contract and updates success, partial and error examples in the same change.
4. Each consumer updates its contract test before the change enters an integration merge window.

## Daily coordination rhythm

| **Checkpoint** | **Maximum** | **Required output** |
| --- | --- | --- |
| Morning contract check | 15 min | Blockers, interface changes and today's exit gate. |
| Afternoon integration | 20 min | Merged vertical slice plus five-minute smoke test. |
| Night release check | 20 min | Deploy status, regression result and known-issue log. |

# 10. Day-by-day execution roadmap - Days 1-6

Each row ends in an observable integration gate. A task is not complete merely because it works in the owner's branch.

| **Day** | **Milestone** | **Dev 1 - UX** | **Dev 2 - Platform** | **Dev 3 - Agents** | **Dev 4 - Intelligence** | **Exit gate** |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Scope and contracts | Confirm four journeys; wireframe chat/map/evidence; create React shell and typed mock response. | Create monorepo/backend; Docker; CI; OpenAPI v1; health route; verify source access for max two hours each. | Define ORCAState, intent taxonomy, graph nodes, tool schemas and stub supervisor flow. | Freeze pilot area; collect sample PFZ/weather/geofence data; draft risk and route rules. | Contracts signed; pilot and source fallback decisions recorded; no unresolved ownership. |
| 2 | Walking skeleton | Render chat, static map and evidence cards from backend mock; add sample-query buttons. | Implement /chat, /runs and /layers stubs; repository interfaces; local start/reset commands. | Run intent -> plan -> fake tools -> validate -> synthesize; emit trace events. | Expose deterministic stub tools backed by versioned fixtures and expected outputs. | One query produces answer + recommendation + map + evidence + trace end to end. |
| 3 | Real data foundation | Build layer manager, map legend, popups and evidence drawer using contract data only. | Implement SourceAdapter, one live forecast connector, snapshot loader, timeout/retry and freshness fields. | Add parallel tool dispatch, bounded retry/fallback and structured partial-failure handling. | Normalize pilot PFZ/geofences; implement geometry validation, distance and time utilities. | At least one real source and one snapshot source render with provider and valid time. |
| 4 | PFZ journey | Add nearest-PFZ card, distance/direction, marker selection and route-to-zone line. | Add INCOIS adapter or approved snapshot; persist evidence and GeoJSON; add contract tests. | Implement PFZ intent plan, missing-origin clarification and evidence-bound summary. | Implement nearest-PFZ ranking and favourable-condition context from available observations. | PFZ query returns ranked candidate, map geometry, source and validity with no hard-coded UI. |
| 5 | Safety journey | Add GO/CAUTION/NO\_GO/UNKNOWN banner, decisive-factor cards and uncertainty messaging. | Add official warning/forecast adapter or snapshot; enforce cache freshness and standard errors. | Build safety plan across weather, marine and risk tools; conservative synthesis and follow-ups. | Implement configurable risk engine, hard stops and safe/caution/no-go/unknown fixtures. | Four fixtures change status predictably and every factor links to evidence. |
| 6 | Route and geofence | Add origin/destination inputs, route selector, exposure legend and boundary warning. | Persist/serve route GeoJSON; cache results by data version and request; add validation limits. | Implement route intent planning and explanation comparing distance, hazards and restrictions. | Generate/accept 2-3 candidate corridors; sample exposure; check polygons; rank with reasons. | A hazardous/restricted route loses to a safer candidate or returns UNKNOWN with reason. |

|  |
| --- |
| **Daily merge discipline:** Contract check at 10:00 IST; integration merge windows at 14:00 and 21:00 IST; a five-minute deployed smoke test follows every merge. Shift the times if needed, but keep two fixed windows. |

# 10. Day-by-day execution roadmap - Days 7-12

Each row ends in an observable integration gate. A task is not complete merely because it works in the owner's branch.

| **Day** | **Milestone** | **Dev 1 - UX** | **Dev 2 - Platform** | **Dev 3 - Agents** | **Dev 4 - Intelligence** | **Exit gate** |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | Multi-turn conversation | Add history, clarification UI, suggested follow-ups and retained map context. | Persist thread/run state, TTL/retention and trace retrieval; stabilize API error mapping. | Implement thread memory, context resolution, intent switching and maximum-step termination. | Make tools consume resolved location/time/profile; test follow-up and edge-context cases. | 'What about tomorrow?' and 'show a safer route' reuse context correctly. |
| 8 | Reliability and language | Complete Hindi/Marathi layout; stale/partial/source-outage states; loading and retry UX. | Finish live/hybrid/snapshot modes, structured logs, request IDs, source status and seed command. | Add locale pipeline, evidence validator, injection guards, source-conflict and outage behaviour. | Finish freshness/confidence inputs, stale/missing tests and map-layer quality flags. | Regional-language query and forced source outage degrade safely and transparently. |
| 9 | Feature freeze and deploy | Responsive/a11y pass, remove leftover mocks, zero console errors and capture baseline screenshots. | Deploy staging; configure database/secrets/CORS; migration and rollback; tag release candidate 1. | Tune prompts/parallelism/token budget; freeze agent topology and publish example trace. | Audit thresholds, geometries, timestamps and golden outputs; freeze fixture version. | Release candidate runs all four journeys remotely and locally; no new MVP features after today. |
| 10 | Full-system QA | Run UI unit tests and Playwright happy path; fix only P0/P1 UX defects. | Run connector/contract/integration tests, latency smoke test and clean-checkout deployment drill. | Run 20-query agent evaluation; inspect wrong tools, unsupported claims, loops and language drift. | Run unit/property tests for distance, polygon, route, freshness and safety overrides. | Acceptance scorecard passes; three complete rehearsals succeed in snapshot and hybrid mode. |
| 11 | Judge-proofing | Polish visual hierarchy; prepare clean screenshots; ensure projector-scale readability. | Complete runbook, source-status panel, local backup package and recovery drill. | Prepare architecture/agent trace explanation and three failed-source examples for Q&A. | Prepare data lineage, algorithm, limitations and deterministic-output explanations. | Five-minute live script and two-minute backup video work on presentation laptop. |
| 12 | Final freeze | Package final frontend; verify browser cache reset and display settings. | Tag final release, export database/fixtures, verify URLs and lock environment configuration. | Lock prompts/model config; export evaluation report and trace samples. | Checksum fixtures/config; verify all golden scenarios and evidence timestamps. | Ten consecutive demo runs; final README; no code changes after noon except a verified P0 fix. |

|  |
| --- |
| **Daily merge discipline:** Contract check at 10:00 IST; integration merge windows at 14:00 and 21:00 IST; a five-minute deployed smoke test follows every merge. Shift the times if needed, but keep two fixed windows. |

# 11. Repository, API and integration protocol

## Recommended repository boundaries

|  |
| --- |
| orca/  frontend/ # Dev 1  backend/app/  api/ contracts/ connectors/ # Dev 2  repositories/ core/ # Dev 2  agents/ prompts/ # Dev 3  domain/ tools/marine/ # Dev 4  tools/geospatial/ # Dev 4  data/fixtures/ # Dev 4; source register by Member 5  tests/contract/ integration/ # Dev 2  tests/agent\_eval/ # Dev 3  tests/domain/ # Dev 4  docs/ demo/ # Members 5 and 6  docker-compose.yml # Dev 2 |

## Minimum API surface

| **Endpoint** | **Purpose** | **Owner / consumer** |
| --- | --- | --- |
| GET /health | Service, database and connector-mode health. | Dev 2 / deployment |
| POST /api/v1/chat | Submit query/context and return ChatResponse with run ID. | Dev 2 route; Dev 3 graph; Dev 1 |
| GET /api/v1/runs/{id} | Return status and high-level agent trace. | Dev 2 store; Dev 1 |
| GET /api/v1/map/layers/{id} | Return referenced GeoJSON FeatureCollections. | Dev 2 route; Dev 4 geometry; Dev 1 |
| GET /api/v1/demo-scenarios | List approved reproducible scenarios and data mode. | Dev 2 / Dev 1 and Member 6 |

## ChatResponse fields frozen on Day 1

|  |
| --- |
| { run\_id, conversation\_id, language, intent, answer,  recommendation: {status, summary, decisive\_factors, next\_action},  confidence: {level, reasons}, evidence: EvidenceItem[],  map\_layers: [{layer\_id, type, label, style\_hint}],  trace: [{step, agent, status, duration\_ms, evidence\_ids}],  warnings: [], suggested\_followups: [] } |

## Git and integration rules

* main stays protected. Work in feature/<owner>-<capability>; keep PRs small enough to review in 15 minutes.
* No cross-module refactor after Day 5 without all affected owners approving an interface-change note.
* Every PR includes tests, one sample input/output, changed environment variables and a screenshot or trace when user-visible.
* Contract tests block merge. Mock data may cross a boundary only through the same schema used by live data.
* P0 defects: crash, wrong safety state, missing evidence, broken demo path or data leakage. P1: major journey impairment. Everything else waits.
* Dev 2 integrates; the owner of a failing module fixes it. Integration ownership never means silently rewriting another person's implementation.

# 12. Acceptance, testing and evaluation

## Release acceptance scorecard

| **Area** | **Release target** | **Owner** |
| --- | --- | --- |
| Canonical journeys | 4/4 complete in hybrid and snapshot modes. | All; Member 6 records |
| Golden scenarios | 8/8 match expected structured status, evidence and geometry. | Dev 4 |
| Agent evaluation | 20/20 terminate; >=90% choose required tools; zero safety-override violations. | Dev 3 |
| Evidence | 100% of displayed numeric facts carry evidence ID, source and valid/retrieval time. | Dev 3 + Member 5 |
| Failure handling | Three forced source outages produce partial/unknown results within timeout; no hang. | Dev 2 |
| UI | No console error; correct point/line/polygon rendering; keyboard-accessible critical actions. | Dev 1 |
| Performance | Warm canonical query target <=12 seconds; loading state appears within 300 ms. | Dev 2 + Dev 3 |
| Demo reliability | 10 consecutive final-laptop runs; offline backup and video confirmed. | Member 6 |

*Targets are prototype acceptance criteria, not production service-level guarantees.*

## Eight required deterministic scenarios

| **ID** | **Scenario** | **Expected system behaviour** |
| --- | --- | --- |
| S1 | Normal conditions with complete data | GO only if configured conditions pass; show decisive evidence. |
| S2 | Elevated sea state | CAUTION or NO\_GO according to rules; identify limiting factors. |
| S3 | Active severe marine/cyclone warning | Hard NO\_GO; model cannot soften the result. |
| S4 | Missing/stale critical forecast | UNKNOWN or CAUTION; clearly state the data gap. |
| S5 | Nearest PFZ from fixed landing centre | Correct rank, distance, direction, geometry and validity. |
| S6 | Candidate route crosses restricted polygon | Route rejected or heavily penalized; boundary reason visible. |
| S7 | Alternative route reduces hazard exposure | Safer candidate ranks first with factor comparison. |
| S8 | Hindi/Marathi multi-turn follow-up | Language and previous location/time context remain correct. |

## Test ownership

* Dev 1: component tests, map-layer contract test and one Playwright journey.
* Dev 2: API validation, recorded connector responses, data-mode fallback, persistence and clean-start integration tests.
* Dev 3: intent/tool-selection/evidence/language/safety-override evaluation; loop and prompt-injection tests.
* Dev 4: distance, coordinate order, point-in-polygon, boundary touch, route exposure, freshness, confidence and risk-rule tests.
* Member 5: human evidence/translation/domain review. Member 6: exploratory, deployment and presentation-laptop regression.

# 13. Demonstration flow and safety guardrails

## Five-minute demonstration

1. Set the pilot landing centre and show that ORCA is in hybrid mode with source status and timestamps visible.
2. Ask in Marathi or Hindi: 'Is it safe to go tomorrow at 6 AM?' Show intent extraction, parallel marine/weather tasks and the final risk gate.
3. Open the evidence drawer and map layers to prove which observations support each decisive factor.
4. Ask the follow-up: 'Where is the nearest PFZ, and which route is safer?' Show retained context, ranked PFZ and route comparison.
5. Switch to the approved severe-alert or boundary-crossing scenario. Demonstrate the hard NO\_GO override and clear explanation.
6. End on the architecture/trace view: plan, agents used, tool status, evidence IDs and total duration - not hidden chain-of-thought.

|  |
| --- |
| **Demo rule:** Never depend on a cyclone or warning being live on presentation day. The scenario selector must display that it is a recorded, timestamped test scenario so the demonstration remains honest and reproducible. |

## Required guardrails

| **Risk** | **Control** | **Owner** |
| --- | --- | --- |
| Hallucinated facts | Structured tools; evidence validator; omit unsupported numbers; show source/time beside claims. | Dev 3 |
| Unsafe optimism | Deterministic hard stops; missing critical data cannot produce GO. | Dev 4 |
| Prompt injection in sources | Allowlisted tools/domains; treat fetched text as untrusted data; no dynamic code/tool creation. | Dev 2 + Dev 3 |
| Source outage/latency | Timeout, retry, circuit-style disable, labelled snapshot fallback and bounded total run time. | Dev 2 |
| Location privacy | Explicit location input/consent, short retention, delete/reset control, no exact coordinates in routine logs. | Dev 1 + Dev 2 |
| Misuse as navigation | Persistent prototype disclaimer and language that supports decisions without claiming certification. | All; Member 5 reviews |

## Risk register

| **Likely sprint risk** | **Early signal** | **Response** |
| --- | --- | --- |
| Official API is gated or unstable | No usable payload by Day 1 review | Freeze adapter interface; use an approved snapshot; keep access work out of critical path. |
| Agent outputs vary | Golden scenario status/reasons drift | Move logic into deterministic tools; lower temperature; validate schema and evidence. |
| Geospatial scope explodes | Raster/route work blocks Day 4 PFZ gate | Keep one bounding box; use vector fixtures and candidate routes; defer national raster pipeline. |
| Frontend waits for backend | UI still uses unrelated mocks after Day 2 | Dev 2 publishes examples first; Dev 1 mocks only the frozen contract. |
| Late merge breaks demo | New fields/topology after Day 9 | Feature freeze; only P0/P1 fixes; tag and rehearse release candidates. |
| Team collision | Multiple developers edit same module | Enforce ownership matrix and interface issues; revert unauthorized cross-module changes through review. |

# 14. Buffer features - build only after the MVP passes

|  |
| --- |
| **Start condition:** Do not begin any item below until the Day 9 release candidate passes all four journeys in snapshot and hybrid modes. Select at most one Tier A/B item; reliability and presentation quality outrank feature count. |

| **Priority** | **Feature** | **Judge value** | **Effort / stop rule** |
| --- | --- | --- | --- |
| A1 | Animated live agent progress via SSE/WebSocket | Makes planning and collaboration visibly real. | 0.5-1 day; stop if it destabilizes /chat. |
| A2 | Time slider for forecast and layer validity | Strong spatial-temporal storytelling. | 0.5-1 day; requires already-normalized timestamps. |
| A3 | Browser voice input + read-aloud in one regional language | Improves fisherman accessibility narrative. | 0.5-1 day; keep typed fallback. |
| B1 | SST/chlorophyll raster overlay with point sampling | Visually links Earth Observation to PFZ context. | 1-2 days; one preprocessed scene only. |
| B2 | Simulated moving vessel and proactive geofence alert | Shows boundary safety before the user asks. | 1 day; simulated track must be labelled. |
| B3 | Downloadable trip briefing | Useful handoff for low-connectivity planning. | 0.5 day; generate from existing response only. |
| C1 | Grid A\* route with dynamic re-routing | Deeper optimization story. | 2+ days; do not attempt before every core gate is green. |
| C2 | Offline-first PWA with queued queries | High field usability. | 2+ days; defer if service worker adds caching bugs. |
| C3 | Advisory RAG / productivity trend explanation | Supports research-oriented questions. | 2+ days; needs evaluated corpus and citations. |
| C4 | Redis, job queue and push notifications | Production-scale architecture path. | 2+ days; describe in roadmap rather than build unless necessary. |

## Features to cut immediately

* Training a new SST/chlorophyll/PFZ forecasting model; it cannot be validated credibly in this sprint.
* Nationwide high-resolution ingestion, all Indian languages or production-grade vessel navigation.
* Independent microservices for every agent, Kubernetes, event buses and a large observability stack.
* Blockchain, NFTs, generic dashboards or features unrelated to the problem statement's decision-support flow.
* Autonomous open-web crawling. Agents must use allowlisted, versioned data tools.
* Production identity/RBAC, real-time AIS hardware integration, native mobile apps or satellite download automation.

# 15. Final checklist and first 24 hours

## First 24-hour actions

1. Assign actual names to Developer 1-4 and Member 5-6; each person accepts the owns / must-not-do boundaries.
2. Choose one Maharashtra landing centre and freeze the demo bounding box, coordinate order and timezone.
3. Test official source access. Decide live versus snapshot for every source before the two-hour kill-switch expires.
4. Commit OpenAPI v1, ToolResult, ChatResponse, agent trace vocabulary and three sample payloads.
5. Create eight scenario fixtures with expected status/evidence/geometry and a source register.
6. Build the Day 2 vertical slice immediately. Do not wait for real data or final algorithms to connect the full path.

## Final release checklist

* Four canonical journeys pass in both hybrid and snapshot modes.
* No visible value lacks source, valid/retrieval time or quality warning.
* Safety hard stops, stale-data downgrade and source-outage paths are covered by tests.
* Agent trace shows high-level plan/tools/results without exposing hidden reasoning.
* No frontend direct source calls, no prompt-embedded domain math and no unauthorized cross-module code.
* Staging and clean local startup work; final-laptop browser cache and display scale are tested.
* Demo script, backup snapshot, two-minute video, screenshots, architecture explanation and source limitations are ready.
* README states prototype limitations and gives exact setup, data-mode and reset commands.

## Official and technical references used to ground this plan

* [INCOIS Potential Fishing Zone Advisory](https://incois.gov.in/MarineFisheries/PfzAdvisory)
* [INCOIS Ocean State Forecast service](https://incois.gov.in/site/services/osf.jsp)
* [India Meteorological Department API reference](https://api.imd.gov.in/public/api_reference.html)
* [MOSDAC Oceansat-2 overview](https://www.mosdac.gov.in/oceansat-2-introduction)
* [Open-Meteo Marine Weather API](https://open-meteo.com/en/docs/marine-weather-api)
* [LangGraph overview and execution model](https://docs.langchain.com/oss/python/langgraph/overview)
* [PostGIS geography data management](https://postgis.net/docs/using_postgis_dbmanagement.html)
* [MapLibre GL JS documentation](https://www.maplibre.org/maplibre-gl-js/docs/)
* [FastAPI WebSocket documentation](https://fastapi.tiangolo.com/advanced/websockets/)

*Accessed 4 September 2026. The team must verify current terms, access controls, licences and payload formats before relying on a live integration.*

|  |
| --- |
| **Final principle:** A smaller system that always produces a traceable, geospatial, evidence-backed decision will score better than a broad dashboard with many partially connected features. Protect the four journeys, the safety gate and the demo fallback above everything else. |