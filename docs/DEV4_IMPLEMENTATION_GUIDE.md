# Dev 4 Implementation Guide — Marine & Geospatial Domain Intelligence

**Milestone**: M2  
**Target Audience**: Dev 4 (Marine Science, Geospatial Calculations & Deterministic Risk Engines)  
**Author**: Dev 3 (Agent Orchestration & Explainability)  
**Reference Contract**: [DEV2_DEV4_INTEGRATION_CONTRACT.md](file:///c:/Users/dyara/SAMUDRA/docs/DEV2_DEV4_INTEGRATION_CONTRACT.md)  

---

## Overview

Dev 4 owns the deterministic mathematical calculations, Potential Fishing Zone (PFZ) geodesic ranking, navigational channel exposure assessments, and the Core Safety Risk Engine.

You do **NOT** need to call external APIs (Dev 2 provides clean data payloads) or compose conversational messages (Dev 3 formats them). Your algorithms are pure Python domain engines satisfying the typed protocols in `backend/app/agents/integrations/dev4.py`.

---

## 1. Protocols to Implement

Dev 4 must implement three core protocols:

1. `RiskEvaluationEngine`: Evaluates environmental conditions against craft safety thresholds.
2. `PFZRankingEngine`: Sorts PFZ coordinates by geodesic distance, water depth, and oceanographic indicators.
3. `RouteExposureEngine`: Compares passage channels and rates wave/geospatial exposure.

---

## 2. Step-by-Step Implementation

### Step 1: Import Protocols and Payloads
In `backend/app/services/` (or your chosen package):

```python
from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.agents.integrations.dev2 import (
    MarineConditionsPayload,
    WeatherConditionsPayload,
    HazardBulletinPayload,
)
from backend.app.agents.integrations.dev4 import (
    RiskEvaluationEngine,
    RiskAssessmentPayload,
    PFZRankingEngine,
    PFZRankingPayload,
    PFZCandidatePayload,
    RouteExposureEngine,
    RouteExposurePayload,
    EvaluatedRouteItem,
)
from backend.app.contracts.chat import ConfidenceLevel, RecommendationStatus
```

### Step 2: Implement `RiskEvaluationEngine`

Dev 4's Risk Engine is the single source of truth for maritime safety. The orchestrator enforces strict **Safety Invariance**: an LLM will never be allowed to soften a `NO_GO` or `CAUTION` status.

```python
class MarineRiskEngine(RiskEvaluationEngine):
    """Deterministic marine safety evaluation engine."""

    # Craft threshold limits (example)
    CEILINGS = {
        "traditional_non_motorized": {"max_wave_m": 1.2, "max_wind_kts": 15.0},
        "motorized_boat": {"max_wave_m": 2.0, "max_wind_kts": 22.0},
        "mechanized_trawler": {"max_wave_m": 3.2, "max_wind_kts": 30.0},
    }

    def evaluate_risk(
        self,
        context: ToolInvocationContext,
        marine: MarineConditionsPayload,
        weather: WeatherConditionsPayload,
        hazard: HazardBulletinPayload,
    ) -> RiskAssessmentPayload:
        craft = context.craft_profile or "motorized_boat"
        limits = self.CEILINGS.get(craft, self.CEILINGS["motorized_boat"])
        factors = []
        warnings = []

        # 1. Hard Cyclone / Severe Alert Filter
        if hazard.cyclone_warning_active:
            return RiskAssessmentPayload(
                status=RecommendationStatus.NO_GO,
                summary="Active cyclone warning issued by IMD. All maritime departures prohibited.",
                decisive_factors=["Active cyclone alert in monitored coastal zone"],
                recommended_action="Remain moored in harbor. Secure vessel lines.",
                confidence_level=ConfidenceLevel.HIGH,
                confidence_reasons=["Official IMD severe weather bulletin active"],
                warnings=["Severe coastal squalls expected"],
            )

        # 2. Wave Height & Wind Ceilings
        wave = marine.significant_wave_height_m
        wind = weather.wind_speed_knots

        if wave > limits["max_wave_m"]:
            factors.append(f"Wave height {wave}m exceeds {limits['max_wave_m']}m safety ceiling for {craft}")
        if wind > limits["max_wind_kts"]:
            factors.append(f"Wind speed {wind} kts exceeds {limits['max_wind_kts']} kts ceiling")

        if factors:
            status = RecommendationStatus.NO_GO
            summary = f"Dangerous sea conditions for {craft}."
            action = "Postpone departure until wave and wind subside."
        elif wave >= limits["max_wave_m"] * 0.75 or wind >= limits["max_wind_kts"] * 0.75:
            status = RecommendationStatus.CAUTION
            factors.append(f"Elevated wave state ({wave}m) approaching operational limits")
            summary = f"Moderate sea state requires high caution for {craft}."
            action = "Operate within 5 nm of shore; maintain active VHF radio watch."
        else:
            status = RecommendationStatus.GO
            factors.append(f"Wave height ({wave}m) and wind ({wind} kts) well within limits")
            summary = f"Favorable conditions for {craft} departure."
            action = "Proceed with planned voyage under standard safety protocols."

        return RiskAssessmentPayload(
            status=status,
            summary=summary,
            decisive_factors=factors,
            recommended_action=action,
            confidence_level=ConfidenceLevel.HIGH,
            confidence_reasons=["Verified against physical craft limits"],
            warnings=warnings,
        )
```

### Step 3: Implement `PFZRankingEngine`

```python
class GeodesicPFZRankingEngine(PFZRankingEngine):
    """Ranks Potential Fishing Zones using great-circle geodesic calculations."""

    def rank_pfz_candidates(
        self,
        context: ToolInvocationContext,
        raw_features: List[Dict[str, Any]],
        max_search_radius_nm: float = 50.0,
    ) -> PFZRankingPayload:
        origin = context.origin_harbor or "Ratnagiri"
        # 1. Compute geodesic distances from origin coordinates
        # 2. Filter by max_search_radius_nm
        # 3. Sort by suitability score (distance vs chlorophyll)
        candidates = [...] # Sorted PFZCandidatePayload items
        return PFZRankingPayload(
            origin_harbor=origin,
            total_candidates=len(candidates),
            ranked_candidates=candidates,
        )
```

### Step 4: Register with Dev 3 Tool Registry

```python
from backend.app.agents.tools import tool_registry
from backend.app.agents.integrations.adapters import ProviderToolAdapter

risk_engine = MarineRiskEngine()

# Tool adapter automatically maps arguments from graph state observations
tool_registry.register_tool(
    risk_tool_def,
    lambda **params: ProviderToolAdapter.adapt_risk_evaluation(
        risk_engine.evaluate_risk,
        ToolInvocationContext(**params),
        marine_payload,
        weather_payload,
        hazard_payload,
        is_mock=False,
    )
)
```

---

## 3. Critical Rules for Dev 4

1. **Safety Status Immutability**: Dev 4's `evaluate_risk` determines `RecommendationStatus`. The conversational LLM cannot override or soften this decision.
2. **Deterministic Outputs**: For identical input metrics and vessel class, the engine must return identical recommendations and decisive factors.
3. **Explicit Units**: Always document physical units (`meters`, `knots`, `km`, `nautical_miles`, `celsius`).
4. **Decisive Factors Format**: Keep `decisive_factors` concise and quantitative (e.g. `"Wave height 2.2m exceeds 1.8m ceiling"`).
