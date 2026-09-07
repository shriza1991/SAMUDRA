"""Health Checks for Connectors.

Owned by Dev 2 (Backend Platform).
"""

from typing import Any


def get_connector_health(manager: Any) -> dict[str, Any]:
    """Returns the operational status of the ConnectorManager and its modes."""
    return {
        "mode": getattr(manager.mode, "value", manager.mode),
        "snapshot_configured": manager.snapshot is not None,
        "marine_live_configured": manager.marine_live is not None,
        "weather_live_configured": manager.weather_live is not None,
        "hazard_live_configured": manager.hazard_live is not None,
        "pfz_live_configured": manager.pfz_live is not None,
    }
