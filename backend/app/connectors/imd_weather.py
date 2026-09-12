"""IMD Coastal Weather Bulletin Connector.

Owned by Dev 2 (Backend Platform).

IMD (India Meteorological Department) provides coastal weather observations
including wind speed, gusts, wind direction, and visibility for Indian
coastal stations.

HYBRID mode strategy:
1. Try live IMD endpoint (requires API key)
2. Fall back to Open-Meteo Global Weather API

Dev 3 integration contract:
- Implements `WeatherConditionsProvider` from agents/integrations/dev2.py

Dev 2 mandate (DEV2_IMPLEMENTATION_GUIDE.md):
- Timeout ≤ 4 s
- All timestamps as ISO-8601 UTC strings
- No safety calculations
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.agents.integrations.dev2 import WeatherConditionsPayload
from backend.app.connectors.base import BaseLiveConnector
from backend.app.connectors.open_meteo import OpenMeteoConnector
from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class ImdWeatherConnector(BaseLiveConnector):
    """Connector for IMD Coastal Weather Bulletins.

    Implements:
    - WeatherConditionsProvider — `get_weather_conditions`

    HYBRID fallback strategy:
    1. Try live IMD REST endpoint
    2. Fall back to Open-Meteo Global Weather API (free, no key)
    3. Return DEGRADED payload
    """

    SOURCE_URL = "https://mausam.imd.gov.in/api/coastal_bulletin"

    def __init__(self, data_mode: str | None = None) -> None:
        super().__init__()
        self._data_mode = data_mode
        self._fallback = OpenMeteoConnector()

    @property
    def data_mode(self) -> str:
        return self._data_mode if self._data_mode is not None else settings.DATA_MODE

    @data_mode.setter
    def data_mode(self, value: str) -> None:
        self._data_mode = value

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        """Fetch coastal wind speed, gust, direction, and visibility.

        In LIVE/HYBRID mode: try IMD live, fall back to Open-Meteo.
        In SNAPSHOT mode: caller must redirect to SnapshotConnector.
        """
        harbor = context.origin_harbor or "Ratnagiri"

        if self.data_mode == "SNAPSHOT":
            return self._make_degraded_payload(harbor, "SNAPSHOT_REDIRECT")

        if self.data_mode in ("LIVE", "HYBRID"):
            # Attempt live IMD endpoint
            if settings.IMD_API_KEY:
                try:
                    return self._fetch_imd_weather(harbor, context)
                except Exception as exc:
                    logger.warning(
                        "IMD weather live fetch failed (%s), falling back to Open-Meteo.", exc
                    )

            # Fall back to Open-Meteo
            return self._fallback.get_weather_conditions(context)

        return self._make_degraded_payload(harbor, "ALL_SOURCES_FAILED")

    def _fetch_imd_weather(
        self, harbor: str, context: ToolInvocationContext
    ) -> WeatherConditionsPayload:
        """Attempt live IMD coastal weather bulletin REST call."""
        headers = {"x-api-key": settings.IMD_API_KEY}
        raw = self._get(
            settings.IMD_API_BASE_URL,
            headers=headers,
            harbor=harbor,
        )

        now_utc = datetime.now(UTC)
        return WeatherConditionsPayload(
            harbor=harbor,
            wind_speed_knots=float(raw.get("wind_speed", 0.0)),
            wind_gust_knots=float(raw["gust_speed"]) if raw.get("gust_speed") else None,
            wind_direction_deg=float(raw["direction_deg"]) if raw.get("direction_deg") else None,
            visibility_km=float(raw["visibility_km"]) if raw.get("visibility_km") else None,
            observed_at=raw.get("observed_at", now_utc.isoformat()),
            valid_to=raw.get("valid_to", (now_utc + timedelta(hours=12)).isoformat()),
            source_name="IMD Coastal Weather Bulletin",
            source_url=self.IMD_COASTAL_URL,
        )

    @staticmethod
    def _make_degraded_payload(harbor: str, reason: str) -> WeatherConditionsPayload:
        """Return a clearly-labelled DEGRADED payload on total failure."""
        now_utc = datetime.now(UTC)
        return WeatherConditionsPayload(
            harbor=harbor,
            wind_speed_knots=None,
            wind_gust_knots=None,
            wind_direction_deg=None,
            visibility_km=None,
            observed_at=now_utc.isoformat(),
            valid_to=(now_utc - timedelta(seconds=1)).isoformat(),  # Immediately expired
            source_name=f"IMD Weather (DEGRADED — {reason})",
            source_url=None,
        )
