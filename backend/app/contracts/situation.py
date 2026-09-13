"""Sector Situation Domain and API Contracts for SAMUDRA.

Represents the authoritative sector situation response consumed by the
Authority Command Deck, combining dynamic canonical fleet counts, active
sector hazards, and deterministic risk evaluation from ObservationBundle.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field

from backend.app.contracts.chat import Recommendation, RecommendationStatus, EvidenceItem


class SectorSituationResponse(BaseModel):
    """Authoritative situation evaluation for a coastal surveillance sector."""

    sector_id: str = Field(..., description="Canonical sector public ID (e.g. 'sector-ratnagiri')")
    sector_name: str = Field(..., description="Canonical sector display name (e.g. 'Ratnagiri Sector (MH-03)')")
    harbor_id: str = Field(..., description="Associated canonical harbor ID (e.g. 'harbor-ratnagiri')")
    harbor_name: str = Field(..., description="Associated harbor name (e.g. 'Ratnagiri')")
    situation_status: RecommendationStatus = Field(
        ..., description="Authoritative risk engine recommendation status: GO | CAUTION | NO_GO | UNKNOWN"
    )
    fleet_count: int = Field(
        ..., ge=0, description="Count of canonical vessels assigned to this sector's home harbor"
    )
    active_hazard_count: int = Field(
        ..., ge=0, description="Count of active marine weather hazard bulletins affecting this sector"
    )
    evaluated_at: str = Field(..., description="ISO-8601 UTC evaluation timestamp")
    summary: str = Field(..., description="Executive situation summary from the deterministic risk engine")
    recommendation: Recommendation = Field(
        ..., description="Complete deterministic risk assessment with decisive factors and threshold checks"
    )
    evidence: List[EvidenceItem] = Field(
        default_factory=list, description="Ground-truth evidence records supporting the risk status"
    )
    warnings: List[str] = Field(
        default_factory=list, description="Data quality, staleness, or operational advisory warnings"
    )
