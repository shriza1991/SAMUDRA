"""Offline Snapshot Connector.

Owned by Dev 2 (Backend Platform).
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel

if TYPE_CHECKING:
    from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.agents.integrations.dev2 import (
    HazardBulletinPayload,
    MarineConditionsPayload,
    PFZSourceDataPayload,
    SVASAdvisoryPayload,
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
    reference_url: str | None = None
    status: str = "SIMULATED"


class SnapshotConnector:
    """Offline snapshot connector — reads versioned JSON files from disk."""

    def __init__(self, snapshots_path: str | None = None) -> None:
        self._snapshots_dir = Path(snapshots_path or "data/source_snapshots")

    @staticmethod
    def _normalize_harbor(harbor: str | None) -> str:
        return (harbor or "ratnagiri").strip().lower().replace(" ", "_")

    def _generate_checksum(self, payload: dict[str, Any]) -> str:
        data_str = json.dumps(payload, sort_keys=True).encode("utf-8")
        return hashlib.sha256(data_str).hexdigest()

    def _load_snapshot(self, filename: str) -> dict[str, Any]:
        """Load and validate a versioned snapshot from DB, fallback to file."""
        source_name = filename.replace(".json", "")
        data = None

        # Try DB first
        try:
            from backend.app.db.repositories import ConnectorSnapshotRepository
            from backend.app.db.session import SessionLocal

            with SessionLocal() as session:
                repo = ConnectorSnapshotRepository(session)
                snap = repo.get_by_source(source_name)
                if snap and snap.payload:
                    data = snap.payload
        except Exception as exc:
            logger.debug(f"DB snapshot lookup failed for {source_name}: {exc}")

        # Fallback to file
        if not data:
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
        now = datetime.now(UTC)
        validate_iso8601(meta.valid_from)
        valid_to = datetime.fromisoformat(validate_iso8601(meta.valid_to))

        if now > valid_to:
            raise ConnectorStaleSnapshotError(
                f"Snapshot {meta.snapshot_id} expired at {meta.valid_to}"
            )

        return payload

    def _resolve_fixture(self, prefix: str, harbor: str | None) -> dict[str, Any]:
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

    def get_svas_advisories(self, context: ToolInvocationContext) -> SVASAdvisoryPayload:
        harbor = context.origin_harbor or "Ratnagiri"
        craft = context.craft_profile or "motorized_boat"
        now_utc = datetime.now(UTC)
        valid_to = (now_utc + timedelta(hours=24)).isoformat()
        return SVASAdvisoryPayload(
            harbor=harbor,
            craft_profile=craft,
            advisory_status="SAFE",
            safety_index=2.0,
            capsizing_risk="LOW",
            warning_statement="Snapshot SVAS: sea state within safe craft operating parameters.",
            issued_at=now_utc.isoformat(),
            valid_to=valid_to,
            source_name="INCOIS SVAS (Snapshot Archive)",
            source_url="https://incois.gov.in/portal/svas",
        )

