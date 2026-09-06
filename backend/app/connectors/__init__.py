"""External Data Connectors Package for SAMUDRA.

Owned by Dev 2 (Backend Platform).

Provides typed connector implementations for:
- INCOIS Ocean State Forecast (PFZ + marine conditions)
- IMD Coastal Weather Bulletins
- IMD Hazard / Cyclone Bulletins
- Open-Meteo Marine API (free, no key, fallback)
- Offline Snapshot Connector (fixture files)

Each connector implements the runtime-checkable Protocol from
`backend.app.agents.integrations.dev2` so Dev 3 can detect conformance.

Must NOT contain:
- LLM prompt logic or agent state
- Risk threshold business logic
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HTTP timeout configuration (bounded at 4 s as mandated by Dev 3 contract)
# ---------------------------------------------------------------------------

_DEFAULT_TIMEOUT = httpx.Timeout(
    connect=2.0,
    read=4.0,
    write=2.0,
    pool=2.0,
)


class BaseConnector:
    """Abstract base class for all external data source adapters.

    Sub-classes must call super().__init__() so the shared HTTPX client
    and data-mode are configured consistently.
    """

    def __init__(
        self,
        data_mode: Optional[str] = None,
        timeout: Optional[httpx.Timeout] = None,
    ) -> None:
        self.data_mode = data_mode or settings.DATA_MODE
        self._timeout = timeout or _DEFAULT_TIMEOUT

    # ------------------------------------------------------------------
    # Internal HTTP helper — all connectors go through this so timeouts
    # and error classification are applied uniformly.
    # ------------------------------------------------------------------

    def _get(self, url: str, headers: Optional[Dict[str, str]] = None, **params: Any) -> Dict[str, Any]:
        """Synchronous HTTPX GET with bounded timeout.

        Returns parsed JSON on success.
        Raises `httpx.HTTPError` on transport / HTTP status failures.
        Raises `httpx.TimeoutException` when the timeout is exceeded.
        """
        with httpx.Client(timeout=self._timeout) as client:
            response = client.get(url, headers=headers or {}, params=params)
            response.raise_for_status()
            return response.json()  # type: ignore[return-value]

    async def fetch(self, **kwargs: Any) -> Dict[str, Any]:
        """Async interface placeholder (for future async migration)."""
        raise NotImplementedError
