"""Base Connector Logic.

Owned by Dev 2 (Backend Platform).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

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


import time

from backend.app.core.config import settings


class BaseLiveConnector:
    """Base class for real (live) network connectors.

    Uses synchronous httpx.Client and maps exceptions to normalized ConnectorErrors.
    Implements a basic memory cache and a single retry for transient failures.
    """
    
    # Simple in-memory cache shared across instances: dict[url_with_params, tuple[expiry_timestamp, data]]
    _cache: dict[str, tuple[float, dict[str, Any]]] = {}

    def __init__(self, timeout: httpx.Timeout | None = None) -> None:
        # Default 4-second bounded timeout
        self._timeout = timeout or httpx.Timeout(
            connect=2.0,
            read=4.0,
            write=2.0,
            pool=2.0,
        )
        self._cache_ttl = getattr(settings, "OPEN_METEO_CACHE_TTL_SECONDS", 3600)

    def _get(self, url: str, headers: dict[str, str] | None = None, **params: Any) -> dict[str, Any]:
        """Synchronous HTTPX GET with caching, 1 retry, and exception mapping."""
        from urllib.parse import urlencode
        
        # Build cache key
        query_string = urlencode(params, doseq=True) if params else ""
        cache_key = f"{url}?{query_string}"
        
        # Check cache
        now = time.time()
        if cache_key in self._cache:
            expiry, cached_data = self._cache[cache_key]
            if now < expiry:
                return cached_data
            else:
                del self._cache[cache_key]
                
        # Attempt request with max 1 retry for transient errors
        attempts = 2
        from backend.app.connectors.client import connector_http_client
        
        for attempt in range(attempts):
            try:
                response = connector_http_client.get(url, headers=headers or {}, params=params)
                response.raise_for_status()
                data = response.json()  # type: ignore[no-any-return]
                
                # Store in cache
                self._cache[cache_key] = (time.time() + self._cache_ttl, data)
                return data

            except httpx.TimeoutException as exc:
                if attempt < attempts - 1:
                    continue
                raise ConnectorTimeoutError(f"Timeout reaching {url}") from exc
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status in (502, 503, 504) and attempt < attempts - 1:
                    continue
                if status in (401, 403):
                    raise ConnectorAuthenticationError(f"Authentication failed for {url}") from exc
                if status == 429:
                    raise ConnectorRateLimitError(f"Rate limited by {url}") from exc
                if status >= 500:
                    raise ConnectorUpstreamUnavailableError(f"Upstream {url} returned {status}") from exc
                # Other client errors (e.g., 400, 404)
                raise ConnectorMalformedResponseError(f"Upstream {url} returned bad status {status}") from exc
            except httpx.RequestError as exc:
                if attempt < attempts - 1:
                    continue
                raise ConnectorUpstreamUnavailableError(f"Network error reaching {url}") from exc
            except ValueError as exc:
                # json() parsing failure
                raise ConnectorMalformedResponseError(f"Malformed JSON from {url}") from exc
        
        raise ConnectorUpstreamUnavailableError(f"Failed to reach {url} after {attempts} attempts")
