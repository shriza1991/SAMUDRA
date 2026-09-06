"""Connector Manager.

Owned by Dev 2 (Backend Platform).
"""

from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from backend.app.agents.integrations.contracts import ToolInvocationContext
    from backend.app.agents.integrations.dev2 import (
        HazardBulletinPayload,
        MarineConditionsPayload,
        PFZSourceDataPayload,
        WeatherConditionsPayload,
    )
from backend.app.connectors.errors import (
    ConnectorRateLimitError,
    ConnectorTimeoutError,
    ConnectorUpstreamUnavailableError,
)
from backend.app.connectors.modes import DataMode
from backend.app.connectors.snapshot import SnapshotConnector

logger = logging.getLogger(__name__)


class ConnectorManager:
    """Manages connector routing based on DataMode.
    
    Implements:
    - MarineConditionsProvider
    - WeatherConditionsProvider
    - HazardBulletinsProvider
    - PFZSourceDataProvider
    """

    def __init__(
        self,
        mode: DataMode,
        snapshot_connector: SnapshotConnector,
        marine_live: Any = None,
        weather_live: Any = None,
        hazard_live: Any = None,
        pfz_live: Any = None,
    ) -> None:
        self.mode = mode
        self.snapshot = snapshot_connector
        self.marine_live = marine_live
        self.weather_live = weather_live
        self.hazard_live = hazard_live
        self.pfz_live = pfz_live

    def _execute(
        self,
        live_provider: Any,
        snapshot_method: str,
        context: ToolInvocationContext,
    ) -> Any:
        if self.mode == DataMode.SNAPSHOT:
            return getattr(self.snapshot, snapshot_method)(context)

        if self.mode == DataMode.LIVE:
            if not live_provider:
                raise RuntimeError(f"Live provider not configured for {snapshot_method}")
            return getattr(live_provider, snapshot_method)(context)

        if self.mode == DataMode.HYBRID:
            if not live_provider:
                logger.warning("No live provider for %s, falling back to snapshot.", snapshot_method)
                payload = getattr(self.snapshot, snapshot_method)(context)
                payload.source_name += " [HYBRID Fallback - Missing Provider]"
                return payload

            try:
                return getattr(live_provider, snapshot_method)(context)
            except (
                ConnectorTimeoutError,
                ConnectorUpstreamUnavailableError,
                ConnectorRateLimitError,
            ) as exc:
                logger.warning(
                    "Transient error %s on live provider for %s. Falling back to snapshot.",
                    exc, snapshot_method
                )
                payload = getattr(self.snapshot, snapshot_method)(context)
                payload.source_name += " [HYBRID Fallback - Transient Error]"
                return payload
            # Permanent errors (Authentication, Malformed, Invalid Configuration) propagate up.

        raise ValueError(f"Unknown DataMode: {self.mode}")

    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload:
        return self._execute(self.marine_live, "get_marine_conditions", context)

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        return self._execute(self.weather_live, "get_weather_conditions", context)

    def get_hazard_bulletin(self, context: ToolInvocationContext) -> HazardBulletinPayload:
        return self._execute(self.hazard_live, "get_hazard_bulletin", context)

    def get_pfz_raw_advisories(self, context: ToolInvocationContext) -> PFZSourceDataPayload:
        return self._execute(self.pfz_live, "get_pfz_raw_advisories", context)
