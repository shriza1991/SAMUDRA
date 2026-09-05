# Dev 2 Implementation Guide — External Data Connectors

**Milestone**: M2  
**Target Audience**: Dev 2 (Backend Platform, Connectors & Database)  
**Author**: Dev 3 (Agent Orchestration & Explainability)  
**Reference Contract**: [DEV2_DEV4_INTEGRATION_CONTRACT.md](file:///c:/Users/dyara/SAMUDRA/docs/DEV2_DEV4_INTEGRATION_CONTRACT.md)  

---

## Overview

Dev 2 is responsible for retrieving ocean state forecasts, coastal weather observations, and severe hazard bulletins from external issuing authorities (INCOIS and IMD).

You do **NOT** need to build prompt templates or conversational logic. The agent orchestrator (`Dev 3`) accesses your connectors exclusively through typed protocols and adapters defined in `backend/app/agents/integrations/dev2.py`.

---

## 1. Protocols to Implement

Dev 2 must create classes that satisfy three protocols:

1. `MarineConditionsProvider`: Fetches wave, current, and SST data.
2. `WeatherConditionsProvider`: Fetches wind speed, gusts, direction, and visibility.
3. `HazardBulletinsProvider`: Fetches active cyclone alerts, depressions, and squall warnings.

All three protocols accept a `ToolInvocationContext` and return typed Pydantic payloads.

---

## 2. Step-by-Step Implementation

### Step 1: Create your Connector Classes
In `backend/app/connectors/` (or your chosen package), import the protocols and payloads:

```python
from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.agents.integrations.dev2 import (
    MarineConditionsPayload,
    WeatherConditionsPayload,
    HazardBulletinPayload,
    MarineConditionsProvider,
    WeatherConditionsProvider,
    HazardBulletinsProvider,
)
```

### Step 2: Implement `MarineConditionsProvider` (INCOIS OSF)

```python
class IncoisOceanStateConnector(MarineConditionsProvider):
    """Production connector for INCOIS Ocean State Forecast API/feed."""

    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url

    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload:
        harbor = context.origin_harbor or "Ratnagiri"
        
        # 1. Fetch from INCOIS REST endpoint or PostGIS cache
        raw = self._http_get(f"{self.base_url}/osf/{harbor}")
        
        # 2. Return typed MarineConditionsPayload
        return MarineConditionsPayload(
            harbor=harbor,
            significant_wave_height_m=float(raw["swh"]),
            swell_height_m=float(raw.get("swell_height", 0.0)),
            swell_period_sec=float(raw.get("swell_period", 8.0)),
            surface_current_knots=float(raw.get("current_speed", 0.0)),
            sea_surface_temp_c=float(raw.get("sst", 28.0)),
            observed_at=raw["timestamp_utc"],
            valid_to=raw["valid_to_utc"],
            source_name="INCOIS Ocean State Forecast",
            source_url="https://incois.gov.in/portal/osf",
        )
```

### Step 3: Implement `WeatherConditionsProvider` & `HazardBulletinsProvider` (IMD)

```python
class ImdWeatherConnector(WeatherConditionsProvider, HazardBulletinsProvider):
    """Production connector for IMD Coastal Weather & Cyclone Bulletins."""

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        harbor = context.origin_harbor or "Ratnagiri"
        raw = self._fetch_weather(harbor)
        return WeatherConditionsPayload(
            harbor=harbor,
            wind_speed_knots=float(raw["wind_speed"]),
            wind_gust_knots=float(raw.get("gust_speed", 0.0)),
            wind_direction_deg=float(raw.get("direction_deg", 0.0)),
            visibility_km=float(raw.get("visibility_km", 10.0)),
            observed_at=raw["observed_at"],
            valid_to=raw["valid_to"],
            source_name="IMD Coastal Weather Bulletin",
            source_url="https://mausam.imd.gov.in",
        )

    def get_hazard_bulletin(self, context: ToolInvocationContext) -> HazardBulletinPayload:
        harbor = context.origin_harbor or "Ratnagiri"
        raw = self._fetch_hazards(harbor)
        return HazardBulletinPayload(
            harbor=harbor,
            cyclone_warning_active=bool(raw["cyclone_alert"]),
            squall_alert=bool(raw.get("squall_alert", False)),
            bulletin_id=raw.get("bulletin_id", "IMD-001"),
            severity=raw.get("severity", "NORMAL"),
            headline=raw.get("headline", "No active storm hazard"),
            source_name="IMD Hazard Warning Division",
            source_url="https://mausam.imd.gov.in/hazards",
        )
```

### Step 4: Register with Dev 3 Tool Registry

When ready to wire live connectors into the system, replace the mocks in `tool_registry`:

```python
from backend.app.agents.tools import tool_registry, ToolDefinition
from backend.app.agents.integrations.adapters import ProviderToolAdapter

incois_conn = IncoisOceanStateConnector(...)
imd_conn = ImdWeatherConnector(...)

# Wrap connector functions with Dev 3 adapters:
tool_registry.register_tool(
    marine_tool_def,
    lambda **params: ProviderToolAdapter.adapt_marine_conditions(
        incois_conn.get_marine_conditions,
        ToolInvocationContext(**params),
        is_mock=False, # Marks as REAL_SOURCE
    )
)
```

---

## 3. Critical Rules for Dev 2

1. **Timeout Cap**: Outgoing HTTP requests must time out within 4.0 seconds. Use caching or degraded local snapshots if the external server is down.
2. **Strict UTC Timestamps**: All `observed_at`, `valid_to`, and `retrieved_at` fields must be valid ISO-8601 UTC strings.
3. **No Safety Calculations**: Do **not** evaluate whether wave height is dangerous or safe. Dev 4's Risk Engine handles all thresholds.
4. **No LLM Logic**: Do not format conversational text. Return only structured data fields.
