"""Normalized Connector Exceptions.

Owned by Dev 2 (Backend Platform).
"""

class ConnectorError(Exception):
    """Base exception for all Dev 2 connector errors."""

class ConnectorTimeoutError(ConnectorError):
    """Raised when an upstream provider takes too long to respond."""

class ConnectorAuthenticationError(ConnectorError):
    """Raised on 401/403 or invalid API keys."""

class ConnectorRateLimitError(ConnectorError):
    """Raised on 429 when the provider rate limits the caller."""

class ConnectorUpstreamUnavailableError(ConnectorError):
    """Raised on 502/503/504 or DNS failures from the provider."""

class ConnectorMalformedResponseError(ConnectorError):
    """Raised when the provider returns invalid JSON or violates the expected schema."""

class ConnectorInvalidConfigurationError(ConnectorError):
    """Raised when a connector is missing required configuration (e.g., API URL)."""

class ConnectorMissingSnapshotError(ConnectorError):
    """Raised when a required SNAPSHOT fixture file is missing."""

class ConnectorStaleSnapshotError(ConnectorError):
    """Raised when a SNAPSHOT fixture is found but its valid_to timestamp has expired."""
