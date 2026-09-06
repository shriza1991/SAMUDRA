"""Data Mode Definitions.

Owned by Dev 2 (Backend Platform).
"""

from enum import Enum


class DataMode(str, Enum):
    """Execution mode for Dev 2 connectors.

    LIVE: Always fetch from real providers. Never fall back.
    HYBRID: Try real providers, fall back to SNAPSHOT on transient errors.
    SNAPSHOT: Offline mode. Never make network requests.
    """
    LIVE = "LIVE"
    HYBRID = "HYBRID"
    SNAPSHOT = "SNAPSHOT"
