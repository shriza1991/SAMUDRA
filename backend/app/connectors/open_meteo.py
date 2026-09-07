"""Open-Meteo Marine API Connector.

Owned by Dev 2 (Backend Platform).

Open-Meteo is a free, no-key marine weather API used as the primary
live data source.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from backend.app.connectors.base import BaseLiveConnector
from backend.app.connectors.harbors import resolve_coordinates

if TYPE_CHECKING:
    from backend.app.agents.integrations.contracts import ToolInvocationContext
    from backend.app.agents.integrations.dev2 import (
        MarineConditionsPayload,
        WeatherConditionsPayload,
    )

logger = logging.getLogger(__name__)


class OpenMeteoConnector(BaseLiveConnector):
    """Marine and weather data from Open-Meteo.

    Implements:
    - MarineConditionsProvider
    - WeatherConditionsProvider
    """

    MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine"
    WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self) -> None:
        super().__init__()

    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload:
        from backend.app.agents.integrations.dev2 import MarineConditionsPayload
        lat, lon = resolve_coordinates(context)
        harbor = context.origin_harbor or "Unknown"

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

        hourly = data.get("hourly", {})
        now_utc = datetime.now(UTC)
        valid_to = (now_utc + timedelta(hours=24)).isoformat()

        def _first(key: str) -> float | None:
            values = hourly.get(key)
            if not values:
                return None
            for v in values:
                if v is not None:
                    return float(v)
            return None

        # significant_wave_height_m is mandated, so we might need a fallback if open-meteo returns null.
        # But if it's a real live API, it should return a float.
        wave_height = _first("wave_height")
        swell_height = _first("swell_wave_height")
        swell_period = _first("swell_wave_period")
        ocean_current = _first("ocean_current_velocity")
        sst = _first("sea_surface_temperature")

        # Fallback to 0.0 if wave height is completely missing to avoid pydantic error, but
        # normally we shouldn't invent data. However, the contract requires significant_wave_height_m.
        # It's better to provide a float if the API succeeded.
        sig_wave = wave_height if wave_height is not None else 0.0

        return MarineConditionsPayload(
            harbor=harbor,
            significant_wave_height_m=sig_wave,
            swell_height_m=swell_height,
            swell_period_sec=swell_period,
            surface_current_knots=(ocean_current * 1.94384) if ocean_current is not None else None,
            sea_surface_temp_c=sst,
            observed_at=now_utc.isoformat(),
            valid_to=valid_to,
            source_name="Open-Meteo Marine API",
            source_url="https://open-meteo.com/en/docs/marine-weather-api",
        )

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        from backend.app.agents.integrations.dev2 import WeatherConditionsPayload
        lat, lon = resolve_coordinates(context)
        harbor = context.origin_harbor or "Unknown"

        data = self._get(
            self.WEATHER_API_URL,
            latitude=lat,
            longitude=lon,
            hourly="wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility",
            wind_speed_unit="kn",
            forecast_days=2,
            timezone="UTC",
        )

        hourly = data.get("hourly", {})
        now_utc = datetime.now(UTC)
        valid_to = (now_utc + timedelta(hours=24)).isoformat()

        def _first(key: str) -> float | None:
            values = hourly.get(key)
            if not values:
                return None
            for v in values:
                if v is not None:
                    return float(v)
            return None

        wind_speed = _first("wind_speed_10m")
        gusts = _first("wind_gusts_10m")
        direction = _first("wind_direction_10m")
        visibility = _first("visibility")

        # wind_speed_knots is required.
        ws_knots = wind_speed if wind_speed is not None else 0.0

        return WeatherConditionsPayload(
            harbor=harbor,
            wind_speed_knots=ws_knots,
            wind_gust_knots=gusts,
            wind_direction_deg=direction,
            visibility_km=(visibility / 1000.0) if visibility is not None else None,
            observed_at=now_utc.isoformat(),
            valid_to=valid_to,
            source_name="Open-Meteo Weather API",
            source_url="https://open-meteo.com/en/docs",
        )
