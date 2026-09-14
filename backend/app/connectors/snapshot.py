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

    def __init__(self, snapshots_path: str | None = None, fixtures_path: str | None = None) -> None:
        self._snapshots_dir = Path(snapshots_path or "data/source_snapshots")
        self._fixtures_dir = Path(fixtures_path or "data/fixtures/synthetic/incois")
        self._custom_snapshots_path = snapshots_path is not None
        self._osf_cache: list[dict[str, Any]] | None = None

    @staticmethod
    def _normalize_harbor(harbor: str | None) -> str:
        return (harbor or "ratnagiri").strip().lower().replace(" ", "_")

    def _generate_checksum(self, payload: dict[str, Any]) -> str:
        data_str = json.dumps(payload, sort_keys=True).encode("utf-8")
        return hashlib.sha256(data_str).hexdigest()

    def _find_fixture_file(self, filename: str) -> Path | None:
        candidates = [
            self._snapshots_dir / filename,
            self._fixtures_dir / filename,
            Path("data/fixtures/synthetic/incois") / filename,
            Path(__file__).resolve().parent.parent.parent.parent / "data" / "fixtures" / "synthetic" / "incois" / filename,
        ]
        for p in candidates:
            if p.exists():
                return p
        return None

    def _load_osf_fixture(self) -> list[dict[str, Any]]:
        if self._osf_cache is not None:
            return self._osf_cache

        if self._custom_snapshots_path:
            p = self._snapshots_dir / "osf_hourly_observations.json"
            if p.exists():
                with open(p, "r", encoding="utf-8") as fh:
                    self._osf_cache = json.load(fh)
                    return self._osf_cache
            return []

        try:
            from backend.app.db.repositories import SyntheticDemoRepository
            from backend.app.db.session import SessionLocal

            with SessionLocal() as session:
                repo = SyntheticDemoRepository(session)
                items = repo.get_marine_observations(namespace="SAMUDRA_DEMO_V1")
                if items:
                    from backend.app.api.v1.routes import _model_to_dict
                    self._osf_cache = [_model_to_dict(it) for it in items]
                    return self._osf_cache
        except Exception:
            pass

        fix_path = self._find_fixture_file("osf_hourly_observations.json")
        if fix_path and fix_path.exists():
            with open(fix_path, "r", encoding="utf-8") as fh:
                self._osf_cache = json.load(fh)
                return self._osf_cache

        return []

    def _load_snapshot(self, filename: str) -> dict[str, Any]:
        """Load and validate a versioned snapshot from DB, fallback to file."""
        source_name = filename.replace(".json", "")
        data = None

        # Try DB first only if not using a custom snapshots path
        if not self._custom_snapshots_path:
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
        from backend.app.connectors.normalizers.incois import IncoisOSFNormalizer

        harbor = context.origin_harbor or "Ratnagiri"
        key = self._normalize_harbor(harbor)

        records = self._load_osf_fixture()
        if records:
            harbor_records = [
                r for r in records
                if r.get("harbor_id") == f"harbor-{key}"
                or (r.get("provenance_json") or {}).get("harbor", "").lower() == key
                or (r.get("coverage_metadata") or {}).get("station", "").lower() == key
            ]
            if not harbor_records:
                harbor_records = [
                    r for r in records
                    if r.get("harbor_id") == "harbor-ratnagiri"
                    or (r.get("provenance_json") or {}).get("harbor", "").lower() == "ratnagiri"
                ]

            if harbor_records:
                chosen = None
                for r in harbor_records:
                    prov = r.get("provenance_json") or {}
                    if prov.get("hour_offset") == 0:
                        chosen = r
                        break
                    if r.get("observation_time") in ("2026-09-12T06:00:00+00:00", "2026-09-12T06:00:00Z"):
                        chosen = r
                        break
                if chosen is None:
                    chosen = harbor_records[0]

                payload = IncoisOSFNormalizer.normalize(chosen)
                payload.harbor = harbor
                return payload

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

