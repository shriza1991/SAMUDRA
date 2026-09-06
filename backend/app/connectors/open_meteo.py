"""Open-Meteo Marine API Fallback Connector.

Owned by Dev 2 (Backend Platform).

Open-Meteo is a free, no-key marine weather API used as the primary
HYBRID fallback when INCOIS or IMD endpoints are unreachable.

API reference: https://open-meteo.com/en/docs/marine-weather-api

Dev 2 mandate (from DEV2_IMPLEMENTATION_GUIDE.md):
- Timeout ≤ 4 s
- All timestamps as ISO-8601 UTC strings
- No safety calculations; only raw numeric fields
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.agents.integrations.dev2 import (
    MarineConditionsPayload,
    WeatherConditionsPayload,
)
from backend.app.connectors import BaseConnector
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Harbor → approximate coastal coordinates for Open-Meteo lookups.
# Covers the primary harbors used in SIH scenarios.
# ---------------------------------------------------------------------------
HARBOR_COORDINATES: dict[str, tuple[float, float]] = {
    "ratnagiri": (16.99, 73.28),
    "mumbai": (19.076, 72.877),
    "goa": (15.299, 73.911),
    "mangalore": (12.872, 74.842),
    "kochi": (9.931, 76.267),
    "chennai": (13.082, 80.270),
    "visakhapatnam": (17.685, 83.218),
    "kolkata": (22.572, 88.363),
    "veraval": (20.905, 70.365),
    "puri": (19.810, 85.832),
    "tuticorin": (8.804, 78.135),
}

_DEFAULT_LAT = 16.99
_DEFAULT_LON = 73.28  # Ratnagiri


def _resolve_coordinates(context: ToolInvocationContext) -> tuple[float, float]:
    """Resolve latitude/longitude from context, with harbor lookup fallback."""
    if context.coordinates and len(context.coordinates) >= 2:
        lon, lat = context.coordinates[0], context.coordinates[1]
        return float(lat), float(lon)
    harbor_key = (context.origin_harbor or "ratnagiri").strip().lower()
    return HARBOR_COORDINATES.get(harbor_key, (_DEFAULT_LAT, _DEFAULT_LON))


class OpenMeteoConnector(BaseConnector):
    """Marine and weather data from Open-Meteo (free, no API key required).

    Implements:
    - MarineConditionsProvider — `get_marine_conditions`
    - WeatherConditionsProvider — `get_weather_conditions`

    Fetches hourly forecasts and returns the first available value, since
    Open-Meteo provides forecast data rather than point-in-time bulletins.
    """

    MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine"
    WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self) -> None:
        super().__init__(data_mode="LIVE")

    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload:
        """Fetch wave height, swell, and ocean surface conditions from Open-Meteo."""
        lat, lon = _resolve_coordinates(context)
        harbor = context.origin_harbor or "Ratnagiri"

        try:
            data = self._get(
                self.MARINE_API_URL,
                latitude=lat,
                longitude=lon,
                hourly=(
                    "wave_height,wave_direction,wave_period,"
                    "swell_wave_height,swell_wave_period,ocean_current_velocity,"
                    "sea_surface_temperature"
                ),
                forecast_days=2,
                timezone="UTC",
            )
        except (httpx.TimeoutException, httpx.HTTPError) as exc:
            raise RuntimeError(f"Open-Meteo marine API unavailable: {exc}") from exc

        hourly = data.get("hourly", {})
        now_utc = datetime.now(timezone.utc)
        valid_to = (now_utc + timedelta(hours=24)).isoformat()

        wave_heights: list[float] = [
            float(v) for v in (hourly.get("wave_height") or []) if v is not None
        ]
        swell_heights: list[float] = [
            float(v) for v in (hourly.get("swell_wave_height") or []) if v is not None
        ]
        swell_periods: list[float] = [
            float(v) for v in (hourly.get("swell_wave_period") or []) if v is not None
        ]
        currents: list[float] = [
            float(v) for v in (hourly.get("ocean_current_velocity") or []) if v is not None
        ]
        sst_vals: list[float] = [
            float(v) for v in (hourly.get("sea_surface_temperature") or []) if v is not None
        ]

        return MarineConditionsPayload(
            harbor=harbor,
            significant_wave_height_m=wave_heights[0] if wave_heights else 1.0,
            swell_height_m=swell_heights[0] if swell_heights else None,
            swell_period_sec=swell_periods[0] if swell_periods else None,
            surface_current_knots=(currents[0] * 1.944) if currents else None,  # m/s → knots
            sea_surface_temp_c=sst_vals[0] if sst_vals else None,
            observed_at=now_utc.isoformat(),
            valid_to=valid_to,
            source_name="Open-Meteo Marine API (Fallback)",
            source_url="https://open-meteo.com/en/docs/marine-weather-api",
        )

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        """Fetch wind speed, gusts, direction, and visibility from Open-Meteo."""
        lat, lon = _resolve_coordinates(context)
        harbor = context.origin_harbor or "Ratnagiri"

        try:
            data = self._get(
                self.WEATHER_API_URL,
                latitude=lat,
                longitude=lon,
                hourly="wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility",
                wind_speed_unit="kn",
                forecast_days=2,
                timezone="UTC",
            )
        except (httpx.TimeoutException, httpx.HTTPError) as exc:
            raise RuntimeError(f"Open-Meteo weather API unavailable: {exc}") from exc

        hourly = data.get("hourly", {})
        now_utc = datetime.now(timezone.utc)
        valid_to = (now_utc + timedelta(hours=24)).isoformat()

        wind_speeds: list[float] = [
            float(v) for v in (hourly.get("wind_speed_10m") or []) if v is not None
        ]
        gusts: list[float] = [
            float(v) for v in (hourly.get("wind_gusts_10m") or []) if v is not None
        ]
        directions: list[float] = [
            float(v) for v in (hourly.get("wind_direction_10m") or []) if v is not None
        ]
        visibility: list[float] = [
            float(v) / 1000.0 for v in (hourly.get("visibility") or []) if v is not None  # m → km
        ]

        return WeatherConditionsPayload(
            harbor=harbor,
            wind_speed_knots=wind_speeds[0] if wind_speeds else 10.0,
            wind_gust_knots=gusts[0] if gusts else None,
            wind_direction_deg=directions[0] if directions else None,
            visibility_km=visibility[0] if visibility else None,
            observed_at=now_utc.isoformat(),
            valid_to=valid_to,
            source_name="Open-Meteo Global Weather API (Fallback)",
            source_url="https://open-meteo.com/en/docs",
        )
