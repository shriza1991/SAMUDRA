"""Offline Snapshot Connector.

Owned by Dev 2 (Backend Platform).
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from backend.app.agents.integrations.contracts import ToolInvocationContext

from backend.app.agents.integrations.dev2 import (
    HazardBulletinPayload,
    MarineConditionsPayload,
    PFZSourceDataPayload,
    WeatherConditionsPayload,
)
from backend.app.connectors.base import validate_iso8601
from backend.app.connectors.errors import (
    ConnectorMalformedResponseError,
    ConnectorMissingSnapshotError,
    ConnectorStaleSnapshotError,
)

logger = logging.getLogger(__name__)


class SnapshotMetadata(BaseModel):
    """Metadata envelope for versioned snapshots."""
    snapshot_id: str
    provider: str
    source_name: str
    captured_at: str
    valid_from: str
    valid_to: str
    schema_version: str
    checksum: str
    reference_url: Optional[str] = None
    status: str = "SIMULATED"


class SnapshotConnector:
    """Offline snapshot connector — reads versioned JSON files from disk."""

    def __init__(self, snapshots_path: Optional[str] = None) -> None:
        self._snapshots_dir = Path(snapshots_path or "data/source_snapshots")

    @staticmethod
    def _normalize_harbor(harbor: Optional[str]) -> str:
        return (harbor or "ratnagiri").strip().lower().replace(" ", "_")

    def _generate_checksum(self, payload: Dict[str, Any]) -> str:
        data_str = json.dumps(payload, sort_keys=True).encode("utf-8")
        return hashlib.sha256(data_str).hexdigest()

    def _load_snapshot(self, filename: str) -> Dict[str, Any]:
        """Load and validate a versioned snapshot."""
        path = self._snapshots_dir / filename
        if not path.exists():
            raise ConnectorMissingSnapshotError(f"Snapshot not found: {path}")

        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception as exc:
            raise ConnectorMalformedResponseError(f"Failed to parse {path}") from exc

        if "metadata" not in data or "payload" not in data:
            raise ConnectorMalformedResponseError(f"Missing envelope in {path}")

        try:
            meta = SnapshotMetadata(**data["metadata"])
        except Exception as exc:
            raise ConnectorMalformedResponseError(f"Invalid metadata in {path}") from exc

        payload = data["payload"]
        checksum = self._generate_checksum(payload)
        if checksum != meta.checksum:
            raise ConnectorMalformedResponseError(f"Checksum mismatch in {path}")

        # Validate timestamps
        now = datetime.now(timezone.utc)
        valid_from = datetime.fromisoformat(validate_iso8601(meta.valid_from))
        valid_to = datetime.fromisoformat(validate_iso8601(meta.valid_to))

        if now > valid_to:
            raise ConnectorStaleSnapshotError(f"Snapshot {meta.snapshot_id} expired at {meta.valid_to}")

        return payload

    def _resolve_fixture(self, prefix: str, harbor: Optional[str]) -> Dict[str, Any]:
        """Try harbor-specific fixture first, then default harbor fixture."""
        key = self._normalize_harbor(harbor)
        try:
            return self._load_snapshot(f"{prefix}_{key}.json")
        except ConnectorMissingSnapshotError:
            if key != "ratnagiri":
                return self._load_snapshot(f"{prefix}_ratnagiri.json")
            raise

    # ------------------------------------------------------------------
    # Payload builders
    # ------------------------------------------------------------------

    def get_marine_conditions(self, context: ToolInvocationContext) -> MarineConditionsPayload:
        harbor = context.origin_harbor or "Ratnagiri"
        raw = self._resolve_fixture("marine", harbor)
        raw["harbor"] = harbor
        return MarineConditionsPayload(**raw)

    def get_weather_conditions(self, context: ToolInvocationContext) -> WeatherConditionsPayload:
        harbor = context.origin_harbor or "Ratnagiri"
        raw = self._resolve_fixture("weather", harbor)
        raw["harbor"] = harbor
        return WeatherConditionsPayload(**raw)

    def get_hazard_bulletin(self, context: ToolInvocationContext) -> HazardBulletinPayload:
        harbor = context.origin_harbor or "Ratnagiri"
        raw = self._resolve_fixture("hazard", harbor)
        raw["harbor"] = harbor
        return HazardBulletinPayload(**raw)

    def get_pfz_raw_advisories(self, context: ToolInvocationContext) -> PFZSourceDataPayload:
        raw = self._load_snapshot("pfz_advisories.json")
        return PFZSourceDataPayload(**raw)
