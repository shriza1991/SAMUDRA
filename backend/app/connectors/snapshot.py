"""Offline Snapshot Connector.

Owned by Dev 2 (Backend Platform).

The SnapshotConnector reads pre-seeded fixture JSON files from the
`DATA_FIXTURES_PATH` directory and returns typed payloads.

This connector is the guaranteed-reliable data source for SNAPSHOT mode
and is the final fallback in HYBRID mode when live sources are unavailable.

Fixture file naming convention:
  <DATA_FIXTURES_PATH>/
    marine_<harbor_normalized>.json
    weather_<harbor_normalized>.json
    hazard_<harbor_normalized>.json
    pfz_advisories.json

Where `harbor_normalized` is the harbor name lowercased with spaces
replaced by underscores (e.g., "ratnagiri", "new_mumbai").

If a harbor-specific file is not found, the connector looks for a default
`marine_ratnagiri.json`, `weather_ratnagiri.json`, `hazard_ratnagiri.json`.

Fixture format is the serialized Pydantic model_dump() of the payload class.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.agents.integrations.dev2 import (
    HazardBulletinPayload,
    MarineConditionsPayload,
    PFZSourceDataPayload,
    WeatherConditionsPayload,
)
from backend.app.connectors import BaseConnector
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default embedded fixtures (used when no fixture file is present on disk).
# These represent calm, normal conditions for Ratnagiri so demos never crash.
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _future(hours: int = 24) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


_DEFAULT_MARINE: Dict[str, Any] = {
    "harbor": "Ratnagiri",
    "significant_wave_height_m": 1.2,
    "swell_height_m": 0.8,
    "swell_period_sec": 8.0,
    "surface_current_knots": 1.0,
    "sea_surface_temp_c": 28.0,
    "observed_at": "2026-09-05T04:00:00Z",
    "valid_to": "2026-09-08T18:00:00Z",
    "source_name": "INCOIS OSF Snapshot Fixture",
    "source_url": "https://incois.gov.in/portal/osf",
}

_DEFAULT_WEATHER: Dict[str, Any] = {
    "harbor": "Ratnagiri",
    "wind_speed_knots": 12.0,
    "wind_gust_knots": 16.0,
    "wind_direction_deg": 245.0,
    "visibility_km": 10.0,
    "observed_at": "2026-09-05T03:00:00Z",
    "valid_to": "2026-09-08T18:00:00Z",
    "source_name": "IMD Coastal Weather Snapshot Fixture",
    "source_url": "https://mausam.imd.gov.in",
}

_DEFAULT_HAZARD: Dict[str, Any] = {
    "harbor": "Ratnagiri",
    "cyclone_warning_active": False,
    "squall_alert": False,
    "bulletin_id": "SNAP-IMD-001",
    "severity": "NORMAL",
    "headline": "No active storm hazard (Snapshot Fixture)",
    "valid_from": "2026-09-05T00:00:00Z",
    "valid_to": "2026-09-08T18:00:00Z",
    "source_name": "IMD Cyclone Warning Division Snapshot Fixture",
    "source_url": "https://mausam.imd.gov.in/hazards",
}

_DEFAULT_PFZ: Dict[str, Any] = {
    "features": [
        {"id": "PFZ-SNAP-01", "lat": 16.92, "lon": 73.15, "sst_grad": 0.8, "chlorophyll": 1.4},
        {"id": "PFZ-SNAP-02", "lat": 17.05, "lon": 73.05, "sst_grad": 1.1, "chlorophyll": 1.9},
    ],
    "bulletin_date": "2026-09-05T00:00:00Z",
    "valid_to": "2026-09-08T18:00:00Z",
    "source_name": "INCOIS PFZ Mission Snapshot Fixture",
    "source_url": "https://incois.gov.in/portal/pfz",
}


class SnapshotConnector(BaseConnector):
    """Offline snapshot connector — reads fixture JSON files from disk.

    Serves as the guaranteed fallback when external APIs are offline.
    All payloads emitted are tagged with quality_flags = ['FALLBACK_SNAPSHOT'].

    Implements:
    - MarineConditionsProvider — `get_marine_conditions`
    - WeatherConditionsProvider — `get_weather_conditions`
    - HazardBulletinsProvider — `get_hazard_bulletin`
    - PFZSourceDataProvider — `get_pfz_raw_advisories`
    """

    def __init__(self, fixtures_path: Optional[str] = None) -> None:
        super().__init__(data_mode="SNAPSHOT")
        self._fixtures_dir = Path(fixtures_path or settings.DATA_FIXTURES_PATH)

    # ------------------------------------------------------------------
    # Fixture file resolution helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_harbor(harbor: Optional[str]) -> str:
        return (harbor or "ratnagiri").strip().lower().replace(" ", "_")

    def _load_fixture(self, filename: str, default: Dict[str, Any]) -> Dict[str, Any]:
        """Load a JSON fixture file, returning the embedded default if not found."""
        path = self._fixtures_dir / filename
        if path.exists():
            try:
                with open(path, encoding="utf-8") as fh:
                    return json.load(fh)
            except Exception as exc:
                logger.warning("Fixture %s load failed (%s). Using embedded default.", path, exc)
        logger.debug("Fixture %s not found. Using embedded default.", path)
        return default

    def _resolve_fixture(
        self, prefix: str, harbor: Optional[str], default: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Try harbor-specific fixture first, then default harbor fixture."""
        key = self._normalize_harbor(harbor)
        data = self._load_fixture(f"{prefix}_{key}.json", {})
        if data:
            return data
        if key != "ratnagiri":
            data = self._load_fixture(f"{prefix}_ratnagiri.json", {})
        if data:
            return data
        return default

    # ------------------------------------------------------------------
    # Payload builders — update harbor name from context even for defaults
    # ------------------------------------------------------------------

    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload:
        """Return snapshot marine conditions for the given harbor."""
        harbor = context.origin_harbor or "Ratnagiri"
        raw = self._resolve_fixture("marine", harbor, dict(_DEFAULT_MARINE))
        raw["harbor"] = harbor
        return MarineConditionsPayload(**raw)

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        """Return snapshot weather conditions for the given harbor."""
        harbor = context.origin_harbor or "Ratnagiri"
        raw = self._resolve_fixture("weather", harbor, dict(_DEFAULT_WEATHER))
        raw["harbor"] = harbor
        return WeatherConditionsPayload(**raw)

    def get_hazard_bulletin(self, context: ToolInvocationContext) -> HazardBulletinPayload:
        """Return snapshot hazard bulletin for the given harbor."""
        harbor = context.origin_harbor or "Ratnagiri"
        raw = self._resolve_fixture("hazard", harbor, dict(_DEFAULT_HAZARD))
        raw["harbor"] = harbor
        return HazardBulletinPayload(**raw)

    def get_pfz_raw_advisories(self, context: ToolInvocationContext) -> PFZSourceDataPayload:
        """Return snapshot PFZ advisories."""
        raw = self._load_fixture("pfz_advisories.json", dict(_DEFAULT_PFZ))
        return PFZSourceDataPayload(**raw)
