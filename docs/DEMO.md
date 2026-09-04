# SAMUDRA 5-Minute SIH Jury Demonstration Runbook

> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Jury:** ISRO / Department of Space | **Theme:** Disaster Management  
> **Demonstration Window:** Exactly 5 Minutes

---

## 1. Five-Minute Pitch & Flow Sequence

```
[00:00 - 00:45] The Problem & Prototype Framing (Member 5 & 6)
[00:45 - 01:45] Journey 1: Nearest PFZ Discovery (Dev 1 / Dev 3)
[01:45 - 02:45] Journey 2: GO / NO-GO Safety Decision Gate (Dev 4)
[02:45 - 03:30] Journey 3: Hazard & Maritime Geofence Intersection (Dev 4)
[03:30 - 04:15] Journey 4: Safer Alternative Route Risk Comparison (Dev 1)
[04:15 - 05:00] Evidence Provenance, Offline Resilience & ISRO Alignment (All)
```

---

## 2. Step-by-Step Demonstration Script

### Act 1: The Problem & Positioning (0:00 - 0:45)
- **Speaker**: *"Distinguished jury from ISRO and Department of Space. Coastal fishers and coastal vessels risk life and livelihood navigating complex ocean conditions. While ISRO (MOSDAC) and INCOIS generate world-class ocean observations, interpreting overlapping bulletins, sea state forecasts, and restricted zones requires expert analysis. SAMUDRA is an agentic marine intelligence assistant that combines LangGraph cognitive coordination with 100% deterministic geospatial and safety evaluation."*

### Act 2: Journey 1 — Nearest PFZ Query (0:45 - 1:45)
- **Action**: Click or type: *"Where is the nearest Potential Fishing Zone today from Ratnagiri?"*
- **Visuals**:
  - The agent detects harbor origin and fetches current INCOIS PFZ front lines.
  - The map zooms to Ratnagiri and draws a directional vector to the highest-ranked PFZ candidate (42.6 km WSW).
  - Open the **Evidence Drawer**: Show verified Chlorophyll-a and SST gradient citations with official INCOIS source URLs.

### Act 3: Journey 2 — GO / NO-GO Safety Decision (1:45 - 2:45)
- **Action**: Ask: *"Is it safe to leave Ratnagiri tomorrow at 6 AM on a motorized boat?"*
- **Visuals**:
  - Prominent **`NO_GO` Red Banner** displays immediately.
  - Highlight the **Decisive Factors**: *"Significant wave height 3.4m exceeds craft safety ceiling (2.5m); active IMD coastal squall alert."*
  - **Explain to Judges**: *"Notice our key architectural guardrail: The LLM did not evaluate the wave risk; our deterministic Python risk engine did. The LLM simply translated the deterministic finding into clear, multilingual advice."*

### Act 4: Journey 3 — Hazard & Maritime Boundary Intersection (2:45 - 3:30)
- **Action**: Ask: *"Any cyclone alert or restricted-water conflict if we head towards Sector Delta?"*
- **Visuals**:
  - The map highlights an active Naval Firing polygon and cyclone cone buffer.
  - The system issues an immediate hard-stop with polygon coordinates.
  - Show the **Activity Trace**: Clean lifecycle events showing boundary intersection check using Shapely.

### Act 5: Journey 4 — Safer Alternative Route Comparison (3:30 - 4:15)
- **Action**: Ask: *"Which route from Veraval to Porbandar has lower wave exposure?"*
- **Visuals**:
  - Map renders two candidate routes: Route A (Deep offshore - Amber/Red) vs Route B (Coastal lee - Green).
  - Risk comparison card details exposure score, max wave height, and distance delta.

### Act 6: Offline Resilience & Concluding Statement (4:15 - 5:00)
- **Action**: Switch network toggle to offline or show `DATA_MODE=SNAPSHOT`.
- **Speaker**: *"Notice that if coastal satellite communications drop, SAMUDRA automatically falls back to verified snapshots with clear provenance flags. SAMUDRA bridges ISRO Earth Observation data and grassroots coastal safety through trustworthy, bounded AI."*

---

## 3. Disaster Recovery & Fallback Runbook

| Failure Mode | Immediate Remediation |
| :--- | :--- |
| **Wi-Fi / Internet drops completely during presentation** | Toggle `.env` to `DATA_MODE=SNAPSHOT`. The entire demonstration runs locally from `data/fixtures/` with zero latency. |
| **External INCOIS / IMD API times out or rate limits** | System automatic HYBRID mode silently switches to verified snapshot fixture and appends notice in UI. |
| **LLM API token limit or upstream downtime** | Use pre-seeded LangGraph evaluation run cache or switch to local Ollama instance configured in `.env`. |
| **Laptop hardware crash** | Member 6 immediately connects backup presentation laptop with identical Docker container pre-warmed. |
