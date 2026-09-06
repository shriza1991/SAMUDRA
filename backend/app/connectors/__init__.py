"""External Data Connectors Package for SAMUDRA.

Owned by Dev 2 (Backend Platform).

Provides typed connector implementations.
"""

from __future__ import annotations

from backend.app.connectors.base import BaseLiveConnector, validate_iso8601, validate_coordinates
from backend.app.connectors.errors import (
    ConnectorError,
    ConnectorTimeoutError,
    ConnectorAuthenticationError,
    ConnectorRateLimitError,
    ConnectorUpstreamUnavailableError,
    ConnectorMalformedResponseError,
    ConnectorInvalidConfigurationError,
    ConnectorMissingSnapshotError,
    ConnectorStaleSnapshotError,
)
from backend.app.connectors.health import get_connector_health
from backend.app.connectors.manager import ConnectorManager
from backend.app.connectors.modes import DataMode
from backend.app.connectors.snapshot import SnapshotConnector, SnapshotMetadata

__all__ = [
    "BaseLiveConnector",
    "ConnectorError",
    "ConnectorTimeoutError",
    "ConnectorAuthenticationError",
    "ConnectorRateLimitError",
    "ConnectorUpstreamUnavailableError",
    "ConnectorMalformedResponseError",
    "ConnectorInvalidConfigurationError",
    "ConnectorMissingSnapshotError",
    "ConnectorStaleSnapshotError",
    "ConnectorManager",
    "DataMode",
    "SnapshotConnector",
    "SnapshotMetadata",
    "get_connector_health",
    "validate_iso8601",
    "validate_coordinates",
]
