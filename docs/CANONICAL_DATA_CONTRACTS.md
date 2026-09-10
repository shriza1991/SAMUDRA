# SAMUDRA — Canonical Marine, Weather, Hazard & PFZ Data Contracts

**Classification**: Architecture Specification & Data Dictionary  
**Milestone**: M2–M15 Normalization Standard  
**Problem Statement**: SIH 2026 PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  

---

## 1. Architectural Normalization Pattern

SAMUDRA strictly isolates external data provider schemas (INCOIS, IMD, MOSDAC, Open-Meteo) from the downstream cognitive and rendering layers. 

```
┌────────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL PROVIDERS & CONNECTORS                      │
│      INCOIS OSF / PFZ  │  IMD Weather / Hazards  │  Open-Meteo         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Provider Schemas)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    ADAPTER & NORMALIZATION LAYER                       │
│  - Formulates typed ToolResult & EvidenceItem collections              │
│  - Assigns ISO-8601 UTC timestamps, source URLs, and quality badges    │
│  - Converts physical measurements to standard SI/nautical units        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Normalized Domain Models)
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ AGENT STATE     │        │ RISK & DOMAIN   │        │ FRONTEND UX     │
│ (ORCAState)     │        │ ENGINES         │        │ (React + TS)    │
│                 │        │                 │        │                 │
│ - Task Planning │        │ - Risk Matrix   │        │ - Chat & Advice │
│ - Evidence Gate │        │ - Geodesic PFZ  │        │ - Vector Maps   │
│ - Multi-turn    │        │ - Geofencing    │        │ - Evidence Card │
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

### Core Invariants:
1. **No Provider Leaks into Prompts or Calculations**: Agents and risk engines never parse raw vendor HTML/JSON structures.
2. **Standard Units**:
   - Waves / Swell / Elevation: **meters ($m$)**
   - Wind Speed / Current Velocity: **knots ($kn$)**
   - Distance: **nautical miles ($nm$)** or **kilometers ($km$)**
   - Coordinates: **EPSG:4326 ($[lon, lat]$)**
   - Timestamps: **ISO-8601 UTC ($YYYY-MM-DDTHH:MM:SSZ$)**
3. **Evidence-First Provenance**: Every numerical assertion in the agent answer must link back to an `EvidenceItem` with valid source metadata.

---

## 2. Domain Data Contracts

### 2.1 Marine Conditions (`marine_conditions`)
*Issuing Authorities*: INCOIS (Ocean State Forecast), Open-Meteo Marine (Fallback)

```python
class MarineConditionsPayload(BaseModel):
    harbor: str                              # Target coastal station or landing center
    significant_wave_height_m: float         # Significant wave height (SWH) in meters (>= 0.0)
    swell_height_m: Optional[float]          # Swell height in meters (>= 0.0)
    swell_period_sec: Optional[float]        # Swell period in seconds (>= 0.0)
    surface_current_knots: Optional[float]   # Surface current speed in knots
    sea_surface_temp_c: Optional[float]      # Sea surface temperature (SST) in °C
    observed_at: str                         # Measurement observation timestamp (ISO-8601 UTC)
    valid_to: str                            # Forecast validity expiration (ISO-8601 UTC)
    source_name: str                         # "INCOIS Ocean State Forecast"
    source_url: Optional[str]                # Official bulletin URL
```

#### Normalized Metric Mapping (`EvidenceItem`):
- `metric_name="significant_wave_height"`, `metric_unit="meters"`
- `metric_name="swell_period_sec"`, `metric_unit="seconds"`
- `metric_name="sea_surface_temp_c"`, `metric_unit="celsius"`

---

### 2.2 Weather Conditions (`weather_conditions`)
*Issuing Authorities*: India Meteorological Department (IMD)

```python
class WeatherConditionsPayload(BaseModel):
    harbor: str                              # Monitored coastal station
    wind_speed_knots: float                  # Sustained wind speed in knots (>= 0.0)
    wind_gust_knots: Optional[float]         # Peak wind gust in knots (>= 0.0)
    wind_direction_deg: Optional[float]      # Compass direction (0.0 to 360.0 degrees)
    visibility_km: Optional[float]           # Horizontal visibility in kilometers
    observed_at: str                         # Observation timestamp (ISO-8601 UTC)
    valid_to: str                            # Forecast expiration (ISO-8601 UTC)
    source_name: str                         # "IMD Coastal Weather Bulletin"
    source_url: Optional[str]                # Official bulletin URL
```

#### Normalized Metric Mapping (`EvidenceItem`):
- `metric_name="wind_speed_knots"`, `metric_unit="knots"`
- `metric_name="wind_gust_knots"`, `metric_unit="knots"`
- `metric_name="visibility_km"`, `metric_unit="kilometers"`

---

### 2.3 Severe Weather & Hazards (`hazard_search` & `geospatial_hazard`)
*Issuing Authorities*: IMD Cyclone Warning Division, Naval Maritime Authorities

#### A. Atmospheric Hazard Bulletin (`HazardBulletinPayload`)
```python
class HazardBulletinPayload(BaseModel):
    harbor: str                              # Monitored coastal sector
    cyclone_warning_active: bool             # Active cyclone or deep depression flag
    squall_alert: bool                       # Active gale / squall warning flag
    bulletin_id: Optional[str]               # Official warning bulletin ID (e.g., "IMD-BOB-04")
    severity: str                            # "NORMAL" | "WATCH" | "ALERT" | "WARNING" | "SEVERE"
    headline: Optional[str]                  # Warning summary headline
    valid_from: str                          # Advisory start timestamp (ISO-8601 UTC)
    valid_to: str                            # Advisory expiration timestamp (ISO-8601 UTC)
    source_name: str                         # "IMD Cyclone Warning Division"
    source_url: Optional[str]
```

#### B. Geospatial Boundary & Geofencing (`GeospatialHazardPayload`)
```python
class GeospatialHazardPayload(BaseModel):
    intersected: bool                        # True if coordinates intersect restricted polygon
    restriction_name: Optional[str]          # Polygon label (e.g., "Naval Firing Range Foxtrot")
    restriction_type: Optional[str]          # "NAVAL_RANGE" | "MPA" | "SHALLOW_REEF" | "IMBL"
    distance_to_boundary_km: Optional[float] # Distance to boundary perimeter
    hard_stop: bool                          # True triggers unconditional NO_GO
    restricted: bool                         # True triggers CAUTION advisory
```

---

### 2.4 Potential Fishing Zones (`pfz_search`)
*Issuing Authorities*: INCOIS PFZ Mission / ISRO Oceansat

#### A. Raw Satellite Feature Payload (`PFZSourceDataPayload`)
```python
class PFZSourceDataPayload(BaseModel):
    features: List[Dict[str, Any]]           # Raw GeoJSON features with SST gradients & chlorophyll
    bulletin_date: str                       # Advisory publication date (ISO-8601 UTC)
    valid_to: str                            # Forecast window validity (ISO-8601 UTC)
    source_name: str                         # "INCOIS PFZ Mission"
    source_url: Optional[str]
```

#### B. Geodesically Ranked PFZ Payload (`PFZRankingPayload`)
```python
class PFZCandidatePayload(BaseModel):
    candidate_id: str                        # "PFZ-RAT-01"
    latitude: float                          # Decimal degrees (EPSG:4326)
    longitude: float                         # Decimal degrees (EPSG:4326)
    distance_nautical_miles: float           # Geodesic great-circle distance
    bearing_degrees: float                   # Navigation compass bearing (0-360°)
    water_depth_m: Optional[float]           # Bathymetric depth
    sea_surface_temp_c: Optional[float]      # Temperature at front
    chlorophyll_mg_m3: Optional[float]       # Ocean chlorophyll density
    rank: int                                # 1-indexed proximity & productivity score

class PFZRankingPayload(BaseModel):
    origin_harbor: str
    total_candidates: int
    ranked_candidates: List[PFZCandidatePayload]
```

---

## 3. Downstream Consumption Contract Matrix

| Consumer Tier | Consumed Models | Guarantees & Constraints |
| :--- | :--- | :--- |
| **Deterministic Risk Engine** (`domain/`) | `MarineConditionsPayload`, `WeatherConditionsPayload`, `HazardBulletinPayload` | Mathematical comparisons against vessel ceilings (`motorized_boat`, etc.). **Zero LLM involvement.** |
| **Agent StateGraph** (`agents/graph.py`) | `ToolResult.data`, `EvidenceItem`, `Recommendation` | Coordinates execution DAG, validates claims against evidence, verifies status invariance. |
| **API Response Layer** (`api/v1/routes.py`) | `ChatResponse`, `VoiceChatResponse` | Serializes strictly into canonical contract models for HTTP and voice clients. |
| **Frontend UI** (`frontend/src/`) | `Recommendation`, `EvidenceItem`, `MapLayer`, `AgentTraceItem` | Renders visual badges, evidence drawers, interactive vector maps, and audio playback. |

---

## 4. Contract Conformance Verification

- **Backend Protocol Tests**: [`tests/contract/test_connector_contracts.py`](file:///c:/Users/dyara/SAMUDRA/tests/contract/test_connector_contracts.py) validates runtime conformance of all providers.
- **Frontend TypeScript Typings**: [`frontend/src/types/contracts.ts`](file:///c:/Users/dyara/SAMUDRA/frontend/src/types/contracts.ts) provides compile-time verification mirroring `backend/app/contracts/chat.py`.
