# SAMUDRA 12-Day SIH Prototype Roadmap

> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Philosophy:** Execute the 4 canonical journeys with ruthless focus; defer non-essential features to Post-MVP.

---

## 1. 12-Day Hackathon Implementation Schedule

```
Day 01 ─── Day 03 : Foundation, Contracts & Scaffolding
Day 04 ─── Day 06 : Deterministic Domain Engines & MapLibre Integration
Day 07 ─── Day 09 : LangGraph Agent Pipeline & Hybrid Ingestion
Day 10 ─── Day 11 : Multilingual Support, S1-S8 Evaluation & UI Polish
Day 12            : Feature Freeze, Offline Disaster Recovery & Judge Rehearsal
```

### Phase 1: Foundation, Contracts & Data Scaffolding (Days 1–3)
- [x] **Dev 1**: React + MapLibre UI scaffold; conversation layout, recommendation banner stub. *(COMPLETE on feat/dev1-frontend-ux)*
- [ ] **Dev 2**: FastAPI app setup, PostgreSQL/PostGIS container, shared Pydantic v2 schemas.
- [ ] **Dev 3**: Basic LangGraph state definition, supervisor skeleton, mock agent nodes.
- [ ] **Dev 4**: Populate canonical JSON fixtures for Scenarios S1 through S8 in `data/fixtures/`.
- [ ] **Member 5 & 6**: Validate ground-truth ocean variables; verify fixture realism with domain sources.

### Phase 2: Deterministic Domain Engines & Spatial Visualization (Days 4–6)
- [x] **Dev 1**: Render GeoJSON on MapLibre (PFZ lines, warning polygons, route lines, harbor pins). *(COMPLETE on feat/dev1-frontend-ux)*
- [ ] **Dev 2**: Ingestion connectors for Open-Meteo Marine & stubbed INCOIS/IMD parsers.
- [ ] **Dev 4**: Implement `geodesic_distance`, `pfz_ranker`, `geofence_checker`, and `risk_engine`.
- [ ] **Integration**: First end-to-end integration of deterministic tools returning typed `ToolResult`.

### Phase 3: LangGraph Agent Pipeline & Hybrid Ingestion (Days 7–9)
- [x] **Dev 1**: Evidence drawer and high-level Agent Trace timeline components. *(COMPLETE on feat/dev1-frontend-ux)*
- [ ] **Dev 2**: Implement `DATA_MODE` controller (`LIVE` -> `HYBRID` fallback -> `SNAPSHOT`).
- [ ] **Dev 3**: Complete bounded LangGraph flow: Intent extraction -> Planner -> Tool caller -> Evidence validator -> Response composer.
- [ ] **Member 5**: Review output tone, safety warnings, and terminology accuracy.

### Phase 4: Multilingual Capabilities & Scenario Verification (Days 10–11)
- [x] **Dev 3**: Multilingual prompting for Hindi and Marathi; multi-turn context retention. *(M9 COMPLETE — 239/239 tests passing)*
- [x] **Dev 1 & 4**: Candidate route comparison visualization (Green vs. Amber vs. Red paths). *(COMPLETE on feat/dev1-frontend-ux)*
- [ ] **Member 6**: Execute automated and manual test matrix across S1 through S8.
- [x] **All**: Code cleanup, elimination of console warnings, and responsive layout adjustments. *(Frontend complete)*

### Phase 5: Code Freeze & Presentation Mastery (Day 12)
- [ ] **Strict Code Freeze** at 12:00 IST. Zero new features or schema adjustments.
- [ ] Test offline presentation on demo laptop with network fully disabled (`DATA_MODE=SNAPSHOT`).
- [ ] Member 6 records screen capture demo backup video.
- [ ] Full team 5-minute pitch rehearsal with judge Q&A drill.

---

## 2. Explicit Post-MVP Roadmap (Future Scope for ISRO / Commercialization)

These features are deliberately excluded from the 12-day hackathon prototype:

1. **NavIC (IRNSS) Receiver Hardware Integration**: Direct serial/NMEA-0183 ingestion from boat-mounted NavIC GPS dongles.
2. **Edge Deployment on Low-Power Marine SBCs**: Packaging the agent graph and spatial indexes into a lightweight Docker image running on Raspberry Pi / Jetson onboard vessels.
3. **Automated Marine VHF Radio Voice Synthesizer**: Converting text advisories into automated vernacular synthetic speech broadcasts over VHF Marine Band Channel 16.
4. **Live Satellite AIS Transceiver Feeds**: Fleet-wide vessel tracking and dynamic collision hazard avoidance.
5. **Fisheries Economics & Mandi Auction Integration**: Real-time fish market catch price analytics paired with PFZ discovery.
