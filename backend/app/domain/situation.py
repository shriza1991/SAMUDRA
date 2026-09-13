"""Sector Situation Evaluation Domain Service for SAMUDRA.

Integrates canonical surveillance sectors with:
1. Dynamic fleet count derived from canonical vessel records matching the sector's harbor.
2. Active sector hazard advisories.
3. Relevant observation feeds unified in ObservationBundle.
4. Authoritative risk evaluation via DeterministicRiskEngine.
5. Traceable ground-truth evidence and provenance.

Enforces critical safety invariant: UNKNOWN != GO.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.contracts.chat import (
    Confidence,
    ConfidenceLevel,
    EvidenceItem,
    Recommendation,
    RecommendationStatus,
)
from backend.app.contracts.observation import ObservationBundle
from backend.app.contracts.situation import SectorSituationResponse
from backend.app.domain.risk_engine import DeterministicRiskEngine
from backend.app.services.data_service import DataService

logger = logging.getLogger(__name__)

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "fixtures" / "synthetic" / "samudra"


def _load_canonical_sectors() -> List[Dict[str, Any]]:
    """Loads canonical surveillance sectors from DB or fixture file."""
    sectors_path = FIXTURES_DIR / "sectors.json"
    if sectors_path.exists():
        try:
            with open(sectors_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.debug("Failed reading sectors fixture: %s", exc)
    try:
        from backend.app.db.repositories import SyntheticDemoRepository
        from backend.app.db.session import SessionLocal
        with SessionLocal() as session:
            repo = SyntheticDemoRepository(session)
            items = repo.get_sectors()
            if items:
                from backend.app.api.v1.routes import _model_to_dict
                return [_model_to_dict(i) for i in items]
    except Exception as exc:
        logger.debug("Database get_sectors failed: %s", exc)
    return []


def _resolve_canonical_sector(sector_id: str) -> Optional[Dict[str, Any]]:
    """Find canonical sector metadata by public_id or display name."""
    s = sector_id.strip()
    s_lower = s.lower()
    for sec in _load_canonical_sectors():
        if (
            sec.get("public_id") == s
            or sec.get("name") == s
            or sec.get("public_id", "").lower() == s_lower
            or sec.get("name", "").lower() == s_lower
        ):
            return sec
    return None


def _get_canonical_vessels(harbor_id: str, namespace: str = "SAMUDRA_DEMO_V1") -> List[Dict[str, Any]]:
    """Dynamically query canonical vessels assigned to a specific harbor."""
    try:
        from backend.app.db.repositories import SyntheticDemoRepository
        from backend.app.db.session import SessionLocal
        with SessionLocal() as session:
            repo = SyntheticDemoRepository(session)
            items = repo.get_vessels(namespace=namespace, harbor_id=harbor_id)
            if items:
                from backend.app.api.v1.routes import _model_to_dict
                return [_model_to_dict(i) for i in items]
    except Exception as exc:
        logger.debug("Database get_vessels failed: %s", exc)

    vessels_path = FIXTURES_DIR / "vessels.json"
    if vessels_path.exists():
        try:
            with open(vessels_path, "r", encoding="utf-8") as f:
                records = json.load(f)
                return [v for v in records if v.get("home_harbor_id") == harbor_id]
        except Exception as exc:
            logger.debug("Failed reading vessels fixture: %s", exc)
    return []


def _get_canonical_active_hazards(sector_name: str, namespace: str = "SAMUDRA_DEMO_V1") -> List[Dict[str, Any]]:
    """Retrieve canonical active hazards relevant to the sector."""
    from backend.app.api.v1.routes import get_demo_hazards
    try:
        return get_demo_hazards(sector=sector_name, status="ACTIVE", namespace=namespace)
    except Exception as exc:
        logger.debug("get_demo_hazards failed for %s: %s", sector_name, exc)
        return []


def _harbor_id_to_name(harbor_id: str) -> str:
    """Map canonical harbor_id to common harbor display name for weather/marine lookups."""
    mapping = {
        "harbor-ratnagiri": "Ratnagiri",
        "harbor-malvan": "Malvan",
        "harbor-panaji": "Panaji",
        "harbor-mumbai": "Mumbai",
        "harbor-veraval": "Veraval",
    }
    return mapping.get(harbor_id, harbor_id.replace("harbor-", "").capitalize())


def evaluate_sector_situation(
    sector_id: str,
    bundle: Optional[ObservationBundle] = None,
    reference_time: Optional[datetime | str] = None,
    craft_profile: str = "motorized_boat",
    namespace: str = "SAMUDRA_DEMO_V1",
    data_service: Optional[DataService] = None,
) -> Optional[SectorSituationResponse]:
    """Evaluates the situation and deterministic risk for a canonical surveillance sector.

    Returns None if the sector cannot be resolved (caller should produce 404).
    """
    sector = _resolve_canonical_sector(sector_id)
    if not sector:
        return None

    public_id = sector.get("public_id", sector_id)
    sector_name = sector.get("name", sector_id)
    harbor_id = sector.get("harbor_id", "")
    harbor_name = _harbor_id_to_name(harbor_id)

    # 1. Fleet count dynamically queried from canonical records
    vessels = _get_canonical_vessels(harbor_id=harbor_id, namespace=namespace)
    fleet_count = len(vessels)

    # 2. Active hazards relevant to this sector
    active_hazards = _get_canonical_active_hazards(sector_name=sector_name, namespace=namespace)
    active_hazard_count = len(active_hazards)

    # 3. Assemble context & observation bundle
    context = ToolInvocationContext(
        origin_harbor=harbor_name,
        craft_profile=craft_profile,
    )

    if bundle is None:
        ds = data_service or DataService()
        bundle = ds.get_observation_bundle(context)

    # 4. Deterministic Risk Engine evaluation
    risk_assessment = DeterministicRiskEngine.evaluate(
        context=context,
        bundle=bundle,
        reference_time=reference_time,
    )

    # 5. Extract evaluation timestamp
    if reference_time is not None:
        if isinstance(reference_time, datetime):
            eval_time_str = reference_time.isoformat()
        else:
            eval_time_str = str(reference_time)
    else:
        eval_time_str = datetime.now(UTC).isoformat()

    # 6. Build traceable ground-truth evidence items
    evidence_items: List[EvidenceItem] = []

    if bundle.marine is not None:
        evidence_items.append(
            EvidenceItem(
                evidence_id=f"EV-MARINE-{public_id}",
                source_name=bundle.marine.source_name or "INCOIS Ocean State Forecast",
                source_url=bundle.marine.source_url or "https://incois.gov.in/portal/osf",
                metric_name="significant_wave_height_m",
                metric_value=bundle.marine.significant_wave_height_m,
                unit="m",
                observed_time=bundle.marine.observed_at,
                valid_to=bundle.marine.valid_to,
                quality_flags=["official_source", "incois_osf"],
            )
        )

    if bundle.weather is not None:
        evidence_items.append(
            EvidenceItem(
                evidence_id=f"EV-WEATHER-{public_id}",
                source_name=bundle.weather.source_name or "IMD Coastal Weather",
                source_url=bundle.weather.source_url or "https://mausam.imd.gov.in",
                metric_name="wind_speed_knots",
                metric_value=bundle.weather.wind_speed_knots,
                unit="knots",
                observed_time=bundle.weather.observed_at,
                valid_to=bundle.weather.valid_to,
                quality_flags=["official_source", "imd_aws"],
            )
        )

    if bundle.hazard is not None:
        evidence_items.append(
            EvidenceItem(
                evidence_id=f"EV-HAZARD-{public_id}",
                source_name=bundle.hazard.source_name or "IMD Marine Hazard Bulletin",
                source_url=bundle.hazard.source_url or "https://mausam.imd.gov.in/hazard",
                metric_name="hazard_severity",
                metric_value=bundle.hazard.severity,
                valid_from=bundle.hazard.valid_from,
                valid_to=bundle.hazard.valid_to,
                quality_flags=["official_source", "imd_hazard"],
            )
        )

    # Attach risk status evidence
    evidence_items.append(
        EvidenceItem(
            evidence_id=f"EV-STATUS-{public_id}",
            source_name="SAMUDRA Deterministic Risk Engine",
            metric_name="risk_status",
            metric_value=risk_assessment.status.value,
            quality_flags=["DETERMINISTIC_EVAL"],
        )
    )

    # 7. Construct Recommendation envelope
    recommendation = Recommendation(
        status=risk_assessment.status,
        summary=risk_assessment.summary,
        decisive_factors=risk_assessment.decisive_factors,
        non_decisive_factors=risk_assessment.non_decisive_factors,
        threshold_comparisons=risk_assessment.threshold_comparisons,
        next_action=risk_assessment.recommended_action,
        confidence=Confidence(
            level=risk_assessment.confidence_level,
            reasons=risk_assessment.confidence_reasons,
        ),
        provenance=risk_assessment.provenance,
        evidence_ids=risk_assessment.evidence_ids,
        warnings=risk_assessment.warnings,
    )

    return SectorSituationResponse(
        sector_id=public_id,
        sector_name=sector_name,
        harbor_id=harbor_id,
        harbor_name=harbor_name,
        situation_status=risk_assessment.status,
        fleet_count=fleet_count,
        active_hazard_count=active_hazard_count,
        evaluated_at=eval_time_str,
        summary=risk_assessment.summary,
        recommendation=recommendation,
        evidence=evidence_items,
        warnings=risk_assessment.warnings,
    )
