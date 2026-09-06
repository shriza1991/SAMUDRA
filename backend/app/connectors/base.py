"""Base Connector Logic.

Owned by Dev 2 (Backend Platform).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

import httpx

from backend.app.connectors.errors import (
    ConnectorAuthenticationError,
    ConnectorMalformedResponseError,
    ConnectorRateLimitError,
    ConnectorTimeoutError,
    ConnectorUpstreamUnavailableError,
)

logger = logging.getLogger(__name__)


def validate_iso8601(timestamp: str) -> str:
    """Validate that a timestamp is ISO-8601 and timezone-aware.

    Raises ValueError if invalid.
    """
    try:
        dt = datetime.fromisoformat(timestamp)
        if dt.tzinfo is None:
            raise ValueError(f"Timestamp {timestamp} must be timezone-aware (e.g., UTC).")
        return timestamp
    except Exception as e:
        raise ValueError(f"Invalid ISO-8601 timestamp: {timestamp}. Error: {e}")


def validate_coordinates(lon: float, lat: float) -> None:
    """Validate that coordinates are within standard bounds.

    Raises ValueError if invalid.
    """
    if not (-180.0 <= lon <= 180.0):
        raise ValueError(f"Longitude {lon} out of bounds [-180, 180]")
    if not (-90.0 <= lat <= 90.0):
        raise ValueError(f"Latitude {lat} out of bounds [-90, 90]")


class BaseLiveConnector:
    """Base class for real (live) network connectors.

    Uses synchronous httpx.Client and maps exceptions to normalized ConnectorErrors.
    """

    def __init__(self, timeout: Optional[httpx.Timeout] = None) -> None:
        # Default 4-second bounded timeout
        self._timeout = timeout or httpx.Timeout(
            connect=2.0,
            read=4.0,
            write=2.0,
            pool=2.0,
        )

    def _get(self, url: str, headers: Optional[Dict[str, str]] = None, **params: Any) -> Dict[str, Any]:
        """Synchronous HTTPX GET mapping exceptions to Dev 2 ConnectorErrors."""
        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.get(url, headers=headers or {}, params=params)
                response.raise_for_status()
                return response.json()  # type: ignore[no-any-return]

        except httpx.TimeoutException as exc:
            raise ConnectorTimeoutError(f"Timeout reaching {url}") from exc
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (401, 403):
                raise ConnectorAuthenticationError(f"Authentication failed for {url}") from exc
            if status == 429:
                raise ConnectorRateLimitError(f"Rate limited by {url}") from exc
            if status >= 500:
                raise ConnectorUpstreamUnavailableError(f"Upstream {url} returned {status}") from exc
            # Other client errors (e.g., 400, 404)
            raise ConnectorMalformedResponseError(f"Upstream {url} returned bad status {status}") from exc
        except httpx.RequestError as exc:
            raise ConnectorUpstreamUnavailableError(f"Network error reaching {url}") from exc
        except ValueError as exc:
            # json() parsing failure
            raise ConnectorMalformedResponseError(f"Malformed JSON from {url}") from exc
