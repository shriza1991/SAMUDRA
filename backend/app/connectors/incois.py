"""INCOIS Ocean State Forecast (OSF) Connector.

Owned by Dev 2 (Backend Platform).

INCOIS (Indian National Centre for Ocean Information Services) publishes:
- Ocean State Forecasts (wave height, currents, SST)
- Potential Fishing Zone (PFZ) advisories with satellite-derived data

Current INCOIS REST endpoints are behind a government portal that requires
an approved API key. In HYBRID mode, this connector:
1. Attempts the live INCOIS endpoint (with 4 s timeout)
2. On failure, falls back to Open-Meteo Marine API
3. Tags quality_flags accordingly

In SNAPSHOT mode, data is served from pre-seeded fixtures (handled by
SnapshotConnector via DataService).

Dev 3 integration contract:
- Implements `MarineConditionsProvider` from agents/integrations/dev2.py
- Implements `PFZSourceDataProvider` from agents/integrations/dev2.py

Dev 2 mandate (DEV2_IMPLEMENTATION_GUIDE.md):
- Timeout ≤ 4 s
- All timestamps as ISO-8601 UTC strings
- No safety calculations
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.agents.integrations.dev2 import (
    MarineConditionsPayload,
    PFZSourceDataPayload,
)
from backend.app.connectors import BaseConnector
from backend.app.connectors.open_meteo import OpenMeteoConnector
from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class IncoisOceanStateConnector(BaseConnector):
    """Connector for INCOIS Ocean State Forecast and PFZ advisories.

    Implements:
    - MarineConditionsProvider — `get_marine_conditions`
    - PFZSourceDataProvider — `get_pfz_raw_advisories`

    HYBRID mode strategy:
    1. Try INCOIS live API (returns 4xx / 5xx or times out)
    2. Fall back to Open-Meteo Marine (free, no key)
    3. Final resort: return a labelled DEGRADED payload
    """

    PFZ_SOURCE_URL = "https://incois.gov.in/portal/pfz"
    OSF_SOURCE_URL = "https://incois.gov.in/portal/osf"

    def __init__(self) -> None:
        super().__init__(data_mode=settings.DATA_MODE)
        self._fallback = OpenMeteoConnector()

    # ------------------------------------------------------------------
    # MarineConditionsProvider
    # ------------------------------------------------------------------

    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload:
        """Fetch ocean state: significant wave height, swell, currents, SST.

        In LIVE/HYBRID mode: try INCOIS, fall back to Open-Meteo.
        In SNAPSHOT mode: caller must redirect to SnapshotConnector via DataService.
        """
        harbor = context.origin_harbor or "Ratnagiri"

        if self.data_mode == "SNAPSHOT":
            # Snapshot data is served by DataService; if called directly, return a
            # minimal labelled payload so callers don't crash.
            return self._make_degraded_marine_payload(harbor, "SNAPSHOT_REDIRECT")

        if self.data_mode in ("LIVE", "HYBRID"):
            # Attempt live INCOIS endpoint
            if settings.INCOIS_API_KEY:
                try:
                    return self._fetch_incois_marine(harbor, context)
                except Exception as exc:
                    logger.warning(
                        "INCOIS OSF live fetch failed (%s), falling back to Open-Meteo.", exc
                    )

            # HYBRID / key absent: fall back to Open-Meteo
            if self.data_mode == "HYBRID":
                try:
                    payload = self._fallback.get_marine_conditions(context)
                    logger.info("INCOIS fallback: Open-Meteo marine conditions retrieved.")
                    return payload
                except Exception as exc2:
                    logger.warning(
                        "Open-Meteo fallback also failed (%s). Returning DEGRADED payload.", exc2
                    )

        return self._make_degraded_marine_payload(harbor, "ALL_SOURCES_FAILED")

    def _fetch_incois_marine(
        self, harbor: str, context: ToolInvocationContext
    ) -> MarineConditionsPayload:
        """Attempt live INCOIS OSF REST call."""
        url = f"{settings.INCOIS_API_BASE_URL}/osf"
        headers = {"Authorization": f"Bearer {settings.INCOIS_API_KEY}"}
        try:
            raw = self._get(url, headers=headers, harbor=harbor)
        except httpx.TimeoutException as exc:
            raise RuntimeError(f"INCOIS OSF timeout: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"INCOIS OSF HTTP {exc.response.status_code}") from exc

        now_utc = datetime.now(timezone.utc)
        return MarineConditionsPayload(
            harbor=harbor,
            significant_wave_height_m=float(raw.get("swh", 1.0)),
            swell_height_m=float(raw["swell_height"]) if raw.get("swell_height") else None,
            swell_period_sec=float(raw["swell_period"]) if raw.get("swell_period") else None,
            surface_current_knots=float(raw["current_speed"]) if raw.get("current_speed") else None,
            sea_surface_temp_c=float(raw["sst"]) if raw.get("sst") else None,
            observed_at=raw.get("timestamp_utc", now_utc.isoformat()),
            valid_to=raw.get("valid_to_utc", (now_utc + timedelta(hours=24)).isoformat()),
            source_name="INCOIS Ocean State Forecast",
            source_url=self.OSF_SOURCE_URL,
        )

    @staticmethod
    def _make_degraded_marine_payload(harbor: str, reason: str) -> MarineConditionsPayload:
        """Produce a clearly-labelled UNKNOWN/DEGRADED payload for total failure."""
        now_utc = datetime.now(timezone.utc)
        return MarineConditionsPayload(
            harbor=harbor,
            significant_wave_height_m=0.0,
            swell_height_m=None,
            swell_period_sec=None,
            surface_current_knots=None,
            sea_surface_temp_c=None,
            observed_at=now_utc.isoformat(),
            valid_to=now_utc.isoformat(),  # Immediately expired → stale
            source_name=f"INCOIS OSF (DEGRADED — {reason})",
            source_url=None,
        )

    # ------------------------------------------------------------------
    # PFZSourceDataProvider
    # ------------------------------------------------------------------

    def get_pfz_raw_advisories(self, context: ToolInvocationContext) -> PFZSourceDataPayload:
        """Fetch raw INCOIS PFZ zone advisories.

        Returns GeoJSON-style feature records. In HYBRID mode without a
        valid API key, returns an empty feature set with appropriate labels
        so downstream PFZ ranking (Dev 4) can handle gracefully.
        """
        now_utc = datetime.now(timezone.utc)
        valid_to = (now_utc + timedelta(hours=24)).isoformat()

        if self.data_mode == "SNAPSHOT":
            return PFZSourceDataPayload(
                features=[],
                bulletin_date=now_utc.isoformat(),
                valid_to=valid_to,
                source_name="INCOIS PFZ (SNAPSHOT_REDIRECT)",
                source_url=self.PFZ_SOURCE_URL,
            )

        if settings.INCOIS_API_KEY:
            try:
                return self._fetch_incois_pfz(context)
            except Exception as exc:
                logger.warning("INCOIS PFZ live fetch failed (%s).", exc)

        # Return empty advisory set; Dev 4 will handle absence gracefully
        return PFZSourceDataPayload(
            features=[],
            bulletin_date=now_utc.isoformat(),
            valid_to=valid_to,
            source_name="INCOIS PFZ Mission (HYBRID — live unavailable)",
            source_url=self.PFZ_SOURCE_URL,
        )

    def _fetch_incois_pfz(self, context: ToolInvocationContext) -> PFZSourceDataPayload:
        """Attempt live INCOIS PFZ REST call."""
        url = f"{settings.INCOIS_API_BASE_URL}/pfz"
        headers = {"Authorization": f"Bearer {settings.INCOIS_API_KEY}"}
        raw = self._get(url, headers=headers)
        now_utc = datetime.now(timezone.utc)
        features: List[Dict[str, Any]] = raw.get("features", [])
        return PFZSourceDataPayload(
            features=features,
            bulletin_date=raw.get("bulletin_date", now_utc.isoformat()),
            valid_to=raw.get("valid_to", (now_utc + timedelta(hours=24)).isoformat()),
            source_name="INCOIS PFZ Mission",
            source_url=self.PFZ_SOURCE_URL,
        )
