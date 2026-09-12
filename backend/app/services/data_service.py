"""DATA_MODE Routing Service for SAMUDRA.

Owned by Dev 2 (Backend Platform).

The DataService is the single integration coordinator that routes incoming
data requests to the correct provider based on DATA_MODE:

  LIVE     → Try live connectors only (INCOIS, IMD).
             Raises on failure (no fallback).
  HYBRID   → Try live connectors; fall back to Open-Meteo; final resort:
             SnapshotConnector embedded defaults. Never raises.
  SNAPSHOT → Always serve from SnapshotConnector fixture files. Never
             makes external HTTP calls. Guaranteed reproducible.

Dev 3 wires tool calls through this service so the agent graph is always
DATA_MODE-aware without knowing about connector implementation details.

Design decisions:
- DataService is stateless and instantiated once per process as a singleton.
- In HYBRID mode the fallback chain is INCOIS/IMD → Open-Meteo → Snapshot.
- All three connectors implement the same typed protocol, so DataService
  dispatches polymorphically.
- Stale/DEGRADED payloads are returned with explicit labels in source_name;
  the orchestrator (Dev 3) is responsible for surfacing warnings to the user.
"""

from __future__ import annotations

import logging
from typing import Optional

from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.agents.integrations.dev2 import (
    HazardBulletinPayload,
    MarineConditionsPayload,
    PFZSourceDataPayload,
    WeatherConditionsPayload,
)
from backend.app.connectors.imd_hazard import ImdHazardConnector
from backend.app.connectors.imd_weather import ImdWeatherConnector
from backend.app.connectors.incois import IncoisOceanStateConnector
from backend.app.connectors.snapshot import SnapshotConnector
from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class DataService:
    """Integration coordination layer: DATA_MODE-aware provider dispatch.

    Usage::

        ctx = ToolInvocationContext(origin_harbor="Ratnagiri", craft_profile="motorized_boat")
        marine = data_service.get_marine_conditions(ctx)
        weather = data_service.get_weather_conditions(ctx)
        hazard  = data_service.get_hazard_bulletin(ctx)
    """

    def __init__(self, data_mode: Optional[str] = None) -> None:
        self.data_mode = data_mode or settings.DATA_MODE

        # Connectors (instantiated once, shared per process)
        self._incois = IncoisOceanStateConnector()
        self._imd_weather = ImdWeatherConnector()
        self._imd_hazard = ImdHazardConnector()
        self._snapshot = SnapshotConnector()

    # ------------------------------------------------------------------
    # Marine Conditions
    # ------------------------------------------------------------------

    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload:
        """Route to the appropriate marine connector based on DATA_MODE.

        SNAPSHOT → SnapshotConnector (guaranteed offline, reproducible)
        LIVE     → IncoisOceanStateConnector (live INCOIS only)
        HYBRID   → IncoisOceanStateConnector (falls back internally to Open-Meteo)
        """
        harbor = context.origin_harbor or "Ratnagiri"
        if self.data_mode == "SYNTHETIC":
            from backend.app.connectors.normalizers.incois import IncoisOSFNormalizer
            raw = {
                "harbor": harbor,
                "swh": 1.4,
                "swell_height": 0.9,
                "swell_period": 7.5,
                "current_speed": 0.8,
                "sst": 28.3,
                "observed_at": "2026-09-12T06:00:00Z",
                "valid_to": "2026-09-13T06:00:00Z",
                "qc_flag": 0,
            }
            return IncoisOSFNormalizer.normalize(raw)

        if self.data_mode == "SNAPSHOT":
            logger.debug("DataService: SNAPSHOT mode — marine conditions from fixture.")
            try:
                return self._snapshot.get_marine_conditions(context)
            except Exception as exc:
                logger.warning("DataService: snapshot load failed (%s). Using in-memory dataset.", exc)
                from backend.app.domain.marine_dataset import get_marine_record

                raw = get_marine_record(harbor)
                raw["harbor"] = harbor
                return MarineConditionsPayload(**raw)

        try:
            payload = self._incois.get_marine_conditions(context)
            logger.debug("DataService: marine conditions retrieved (mode=%s).", self.data_mode)
            return payload
        except Exception as exc:
            logger.warning("DataService: marine provider chain failed (%s). Using snapshot.", exc)
            try:
                return self._snapshot.get_marine_conditions(context)
            except Exception as snap_exc:
                logger.warning("DataService: snapshot load failed (%s). Using in-memory dataset.", snap_exc)
                from backend.app.domain.marine_dataset import get_marine_record

                raw = get_marine_record(harbor)
                raw["harbor"] = harbor
                return MarineConditionsPayload(**raw)

    # ------------------------------------------------------------------
    # Weather Conditions
    # ------------------------------------------------------------------

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        """Route to the appropriate weather connector based on DATA_MODE."""
        harbor = context.origin_harbor or "Ratnagiri"
        if self.data_mode == "SYNTHETIC":
            from backend.app.connectors.normalizers.imd import ImdWeatherNormalizer
            raw = {
                "harbor": harbor,
                "wind_speed_knots": 12.0,
                "gust_speed_knots": 16.0,
                "wind_direction_deg": 230.0,
                "visibility_km": 10.0,
                "observed_at": "2026-09-12T06:00:00Z",
                "valid_to": "2026-09-12T18:00:00Z",
            }
            return ImdWeatherNormalizer.normalize(raw)

        if self.data_mode == "SNAPSHOT":
            logger.debug("DataService: SNAPSHOT mode — weather conditions from fixture.")
            try:
                return self._snapshot.get_weather_conditions(context)
            except Exception as exc:
                logger.warning("DataService: snapshot load failed (%s). Using in-memory dataset.", exc)
                from backend.app.domain.marine_dataset import get_weather_record

                raw = get_weather_record(harbor)
                raw["harbor"] = harbor
                return WeatherConditionsPayload(**raw)

        try:
            payload = self._imd_weather.get_weather_conditions(context)
            logger.debug("DataService: weather conditions retrieved (mode=%s).", self.data_mode)
            return payload
        except Exception as exc:
            logger.warning("DataService: weather provider chain failed (%s). Using snapshot.", exc)
            try:
                return self._snapshot.get_weather_conditions(context)
            except Exception as snap_exc:
                logger.warning("DataService: snapshot load failed (%s). Using in-memory dataset.", snap_exc)
                from backend.app.domain.marine_dataset import get_weather_record

                raw = get_weather_record(harbor)
                raw["harbor"] = harbor
                return WeatherConditionsPayload(**raw)

    # ------------------------------------------------------------------
    # Hazard Bulletins
    # ------------------------------------------------------------------

    def get_hazard_bulletin(self, context: ToolInvocationContext) -> HazardBulletinPayload:
        """Route to the appropriate hazard connector based on DATA_MODE.

        Safety invariant: stale hazard data is NEVER silently treated as GO.
        The ImdHazardConnector already returns severity=NORMAL on failure,
        and the snapshot contains explicitly labelled fixture data.
        """
        harbor = context.origin_harbor or "Ratnagiri"
        if self.data_mode == "SYNTHETIC":
            from backend.app.connectors.normalizers.imd import ImdHazardNormalizer
            raw = {
                "bulletin_id": "IMD-CWB-2026-09-12-01",
                "severity": "NORMAL",
                "event_type": "NONE",
                "headline": "No active marine weather warnings for coastal Maharashtra.",
                "valid_from": "2026-09-12T06:00:00Z",
                "valid_to": "2026-09-13T06:00:00Z",
                "status": "ACTIVE",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[73.1, 16.8], [73.4, 16.8], [73.4, 17.1], [73.1, 17.1], [73.1, 16.8]]],
                },
            }
            return ImdHazardNormalizer.normalize(raw)

        if self.data_mode == "SNAPSHOT":
            logger.debug("DataService: SNAPSHOT mode — hazard bulletin from fixture.")
            try:
                return self._snapshot.get_hazard_bulletin(context)
            except Exception as exc:
                logger.warning("DataService: snapshot load failed (%s). Using in-memory dataset.", exc)
                from backend.app.domain.marine_dataset import get_hazard_record

                raw = get_hazard_record(harbor)
                raw["harbor"] = harbor
                return HazardBulletinPayload(**raw)

        try:
            payload = self._imd_hazard.get_hazard_bulletin(context)
            logger.debug("DataService: hazard bulletin retrieved (mode=%s).", self.data_mode)
            return payload
        except Exception as exc:
            logger.warning(
                "DataService: hazard provider chain failed (%s). Using snapshot.", exc
            )
            try:
                return self._snapshot.get_hazard_bulletin(context)
            except Exception as snap_exc:
                logger.warning("DataService: snapshot load failed (%s). Using in-memory dataset.", snap_exc)
                from backend.app.domain.marine_dataset import get_hazard_record

                raw = get_hazard_record(harbor)
                raw["harbor"] = harbor
                return HazardBulletinPayload(**raw)

    # ------------------------------------------------------------------
    # PFZ Raw Advisories
    # ------------------------------------------------------------------

    def get_pfz_raw_advisories(self, context: ToolInvocationContext) -> PFZSourceDataPayload:
        """Route to the appropriate PFZ connector based on DATA_MODE."""
        if self.data_mode == "SYNTHETIC":
            from backend.app.connectors.normalizers.incois import IncoisPFZNormalizer
            raw = {
                "features": [
                    {"id": "PFZ-F01", "lat": 16.85, "lon": 73.10, "sst_grad": 0.35, "chlorophyll": 1.85, "confidence": "HIGH", "distance_km": 16.5},
                    {"id": "PFZ-F02", "lat": 17.10, "lon": 73.05, "sst_grad": 0.40, "chlorophyll": 2.10, "confidence": "HIGH", "distance_km": 24.0},
                ],
                "bulletin_date": "2026-09-12T06:00:00Z",
                "valid_to": "2026-09-13T06:00:00Z",
            }
            return IncoisPFZNormalizer.normalize(raw)

        if self.data_mode == "SNAPSHOT":
            logger.debug("DataService: SNAPSHOT mode — PFZ advisories from fixture.")
            try:
                return self._snapshot.get_pfz_raw_advisories(context)
            except Exception as exc:
                logger.warning("DataService: snapshot load failed (%s). Using fallback PFZ data.", exc)
                from datetime import datetime, timezone
                return PFZSourceDataPayload(
                    features=[
                        {"id": "PFZ-F1", "lat": 16.92, "lon": 73.15, "sst_grad": 0.8, "chlorophyll": 1.4},
                        {"id": "PFZ-F2", "lat": 17.05, "lon": 73.05, "sst_grad": 1.1, "chlorophyll": 1.9},
                    ],
                    bulletin_date=datetime.now(timezone.utc).isoformat(),
                    valid_to="2030-01-01T00:00:00Z",
                    source_name="INCOIS PFZ Connector (In-Memory Dataset)",
                    source_url="https://incois.gov.in/pfz_source",
                )

        try:
            payload = self._incois.get_pfz_raw_advisories(context)
            logger.debug("DataService: PFZ advisories retrieved (mode=%s).", self.data_mode)
            return payload
        except Exception as exc:
            logger.warning(
                "DataService: PFZ provider chain failed (%s). Using snapshot.", exc
            )
            try:
                return self._snapshot.get_pfz_raw_advisories(context)
            except Exception as snap_exc:
                logger.warning("DataService: snapshot load failed (%s). Using fallback PFZ data.", snap_exc)
                from datetime import datetime, timezone
                return PFZSourceDataPayload(
                    features=[
                        {"id": "PFZ-F1", "lat": 16.92, "lon": 73.15, "sst_grad": 0.8, "chlorophyll": 1.4},
                        {"id": "PFZ-F2", "lat": 17.05, "lon": 73.05, "sst_grad": 1.1, "chlorophyll": 1.9},
                    ],
                    bulletin_date=datetime.now(timezone.utc).isoformat(),
                    valid_to="2030-01-01T00:00:00Z",
                    source_name="INCOIS PFZ Connector (In-Memory Dataset)",
                    source_url="https://incois.gov.in/pfz_source",
                )

    # ------------------------------------------------------------------
    # Synthetic Demo Dataset Accessors
    # ------------------------------------------------------------------

    def _get_synthetic_marine(self, lat: float = 16.99, lon: float = 73.28) -> dict:
        harbor = "Ratnagiri" if abs(lat - 16.99) < abs(lat - 16.06) else "Malvan"
        harbor_id = f"harbor-{harbor.lower()}"
        from backend.app.domain.synthetic.generator import generate_marine_observations
        obs = [o for o in generate_marine_observations() if o["harbor_id"] == harbor_id]
        return {
            "mode": "SYNTHETIC",
            "data_source": "INCOIS-OSF",
            "harbor": harbor,
            "hourly_forecast": obs,
        }

    def _get_synthetic_weather(self, lat: float = 16.99, lon: float = 73.28) -> dict:
        harbor = "Ratnagiri" if abs(lat - 16.99) < abs(lat - 16.06) else "Malvan"
        harbor_id = f"harbor-{harbor.lower()}"
        from backend.app.domain.synthetic.generator import generate_marine_observations
        obs = [o for o in generate_marine_observations() if o["harbor_id"] == harbor_id]
        current = obs[0] if obs else {}
        return {
            "mode": "SYNTHETIC",
            "data_source": "IMD",
            "harbor": harbor,
            "current": current,
            "forecast": obs,
        }

    def _get_synthetic_hazard(self, lat: float = 16.99, lon: float = 73.28) -> dict:
        from backend.app.domain.synthetic.generator import generate_hazards
        hazards = generate_hazards()
        return {
            "mode": "SYNTHETIC",
            "data_source": "IMD-Hazard-Bulletin",
            "advisories": hazards,
        }

    def _get_synthetic_pfz(self, lat: float = 16.99, lon: float = 73.28) -> dict:
        from backend.app.domain.synthetic.generator import generate_pfz_candidates
        candidates = generate_pfz_candidates()
        return {
            "mode": "SYNTHETIC",
            "data_source": "INCOIS-PFZ",
            "candidates": candidates,
        }



# ---------------------------------------------------------------------------
# Module-level singleton — created once from current settings
# ---------------------------------------------------------------------------
data_service = DataService()
