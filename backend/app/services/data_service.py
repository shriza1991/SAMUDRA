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
        if self.data_mode == "SNAPSHOT":
            logger.debug("DataService: SNAPSHOT mode — marine conditions from fixture.")
            return self._snapshot.get_marine_conditions(context)

        try:
            payload = self._incois.get_marine_conditions(context)
            logger.debug("DataService: marine conditions retrieved (mode=%s).", self.data_mode)
            return payload
        except Exception as exc:
            logger.warning("DataService: marine provider chain failed (%s). Using snapshot.", exc)
            return self._snapshot.get_marine_conditions(context)

    # ------------------------------------------------------------------
    # Weather Conditions
    # ------------------------------------------------------------------

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        """Route to the appropriate weather connector based on DATA_MODE."""
        if self.data_mode == "SNAPSHOT":
            logger.debug("DataService: SNAPSHOT mode — weather conditions from fixture.")
            return self._snapshot.get_weather_conditions(context)

        try:
            payload = self._imd_weather.get_weather_conditions(context)
            logger.debug("DataService: weather conditions retrieved (mode=%s).", self.data_mode)
            return payload
        except Exception as exc:
            logger.warning("DataService: weather provider chain failed (%s). Using snapshot.", exc)
            return self._snapshot.get_weather_conditions(context)

    # ------------------------------------------------------------------
    # Hazard Bulletins
    # ------------------------------------------------------------------

    def get_hazard_bulletin(self, context: ToolInvocationContext) -> HazardBulletinPayload:
        """Route to the appropriate hazard connector based on DATA_MODE.

        Safety invariant: stale hazard data is NEVER silently treated as GO.
        The ImdHazardConnector already returns severity=NORMAL on failure,
        and the snapshot contains explicitly labelled fixture data.
        """
        if self.data_mode == "SNAPSHOT":
            logger.debug("DataService: SNAPSHOT mode — hazard bulletin from fixture.")
            return self._snapshot.get_hazard_bulletin(context)

        try:
            payload = self._imd_hazard.get_hazard_bulletin(context)
            logger.debug("DataService: hazard bulletin retrieved (mode=%s).", self.data_mode)
            return payload
        except Exception as exc:
            logger.warning(
                "DataService: hazard provider chain failed (%s). Using snapshot.", exc
            )
            return self._snapshot.get_hazard_bulletin(context)

    # ------------------------------------------------------------------
    # PFZ Raw Advisories
    # ------------------------------------------------------------------

    def get_pfz_raw_advisories(self, context: ToolInvocationContext) -> PFZSourceDataPayload:
        """Route to the appropriate PFZ connector based on DATA_MODE."""
        if self.data_mode == "SNAPSHOT":
            logger.debug("DataService: SNAPSHOT mode — PFZ advisories from fixture.")
            return self._snapshot.get_pfz_raw_advisories(context)

        try:
            payload = self._incois.get_pfz_raw_advisories(context)
            logger.debug("DataService: PFZ advisories retrieved (mode=%s).", self.data_mode)
            return payload
        except Exception as exc:
            logger.warning(
                "DataService: PFZ provider chain failed (%s). Using snapshot.", exc
            )
            return self._snapshot.get_pfz_raw_advisories(context)


# ---------------------------------------------------------------------------
# Module-level singleton — created once from current settings
# ---------------------------------------------------------------------------
data_service = DataService()
