"""Provider & Engine Tool Adapters for SAMUDRA / ORCA.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

ADAPTER ARCHITECTURE:
===============================================================================
The agent graph ONLY consumes normalized ToolResult objects.
Adapters sit between external providers (Dev 2 / Dev 4) and the LangGraph graph:
- Validates typed provider responses
- Normalizes data into ToolResult.data
- Formulates standardized EvidenceItem citations with proper quality badges
- Handles exceptions, timeouts, and missing context gracefully
- Maps errors to canonical ToolErrorCode
===============================================================================
"""

from datetime import datetime, timezone
from typing import Any, Callable, Dict, List

from backend.app.agents.integrations.contracts import (
    ToolErrorCode,
    ToolInvocationContext,
)
from backend.app.agents.integrations.dev2 import (
    HazardBulletinPayload,
    MarineConditionsPayload,
    WeatherConditionsPayload,
)
from backend.app.agents.integrations.dev4 import (
    PFZRankingPayload,
    RiskAssessmentPayload,
    RouteExposurePayload,
)
from backend.app.contracts.chat import (
    Confidence,
    EvidenceItem,
    Recommendation,
)
from backend.app.contracts.tools import ToolResult, ToolStatus


class ProviderToolAdapter:
    """Utility class providing normalization adapters for Dev 2 and Dev 4 providers."""

    @staticmethod
    def adapt_marine_conditions(
        provider_fn: Callable[[ToolInvocationContext], MarineConditionsPayload],
        context: ToolInvocationContext,
        is_mock: bool = False,
    ) -> ToolResult:
        """Adapts Dev 2 MarineConditionsProvider output into normalized ToolResult."""
        if not context.origin_harbor:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=["Missing required origin harbor in context."],
                error_code=ToolErrorCode.MISSING_CONTEXT.value,
            )

        try:
            payload = provider_fn(context)
            quality_flags = ["M2_CONTRACT_MOCK", "SIMULATED"] if is_mock else ["REAL_SOURCE", "OFFICIAL"]

            evidence = [
                EvidenceItem(
                    source_name=payload.source_name,
                    source_url=payload.source_url,
                    observed_time=payload.observed_at,
                    valid_to=payload.valid_to,
                    retrieved_at=datetime.now(timezone.utc).isoformat(),
                    metric_name="significant_wave_height",
                    metric_value=payload.significant_wave_height_m,
                    metric_unit="meters",
                    quality_flags=quality_flags,
                )
            ]

            if payload.swell_period_sec is not None:
                evidence.append(
                    EvidenceItem(
                        source_name=payload.source_name,
                        source_url=payload.source_url,
                        observed_time=payload.observed_at,
                        valid_to=payload.valid_to,
                        retrieved_at=datetime.now(timezone.utc).isoformat(),
                        metric_name="swell_period_sec",
                        metric_value=payload.swell_period_sec,
                        metric_unit="seconds",
                        quality_flags=quality_flags,
                    )
                )

            return ToolResult(
                status=ToolStatus.OK,
                data=payload.model_dump(),
                evidence=evidence,
                warnings=[],
            )

        except Exception as exc:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=[f"Marine conditions provider failed: {str(exc)}"],
                error_code=ToolErrorCode.UPSTREAM_FAILURE.value,
            )

    @staticmethod
    def adapt_weather_conditions(
        provider_fn: Callable[[ToolInvocationContext], WeatherConditionsPayload],
        context: ToolInvocationContext,
        is_mock: bool = False,
    ) -> ToolResult:
        """Adapts Dev 2 WeatherConditionsProvider output into normalized ToolResult."""
        if not context.origin_harbor:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=["Missing required origin harbor in context."],
                error_code=ToolErrorCode.MISSING_CONTEXT.value,
            )

        try:
            payload = provider_fn(context)
            quality_flags = ["M2_CONTRACT_MOCK", "SIMULATED"] if is_mock else ["REAL_SOURCE", "OFFICIAL"]

            evidence = [
                EvidenceItem(
                    source_name=payload.source_name,
                    source_url=payload.source_url,
                    observed_time=payload.observed_at,
                    valid_to=payload.valid_to,
                    retrieved_at=datetime.now(timezone.utc).isoformat(),
                    metric_name="wind_speed_knots",
                    metric_value=payload.wind_speed_knots,
                    metric_unit="knots",
                    quality_flags=quality_flags,
                )
            ]

            return ToolResult(
                status=ToolStatus.OK,
                data=payload.model_dump(),
                evidence=evidence,
                warnings=[],
            )

        except Exception as exc:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=[f"Weather conditions provider failed: {str(exc)}"],
                error_code=ToolErrorCode.UPSTREAM_FAILURE.value,
            )

    @staticmethod
    def adapt_hazard_bulletin(
        provider_fn: Callable[[ToolInvocationContext], HazardBulletinPayload],
        context: ToolInvocationContext,
        is_mock: bool = False,
    ) -> ToolResult:
        """Adapts Dev 2 HazardBulletinsProvider output into normalized ToolResult."""
        if not context.origin_harbor:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=["Missing required origin harbor in context."],
                error_code=ToolErrorCode.MISSING_CONTEXT.value,
            )

        try:
            payload = provider_fn(context)
            quality_flags = ["M2_CONTRACT_MOCK", "SIMULATED"] if is_mock else ["REAL_SOURCE", "OFFICIAL"]

            evidence = [
                EvidenceItem(
                    source_name=payload.source_name,
                    source_url=payload.source_url,
                    valid_from=payload.valid_from,
                    valid_to=payload.valid_to,
                    retrieved_at=datetime.now(timezone.utc).isoformat(),
                    metric_name="cyclone_warning_active",
                    metric_value=payload.cyclone_warning_active,
                    quality_flags=quality_flags,
                )
            ]

            return ToolResult(
                status=ToolStatus.OK,
                data=payload.model_dump(),
                evidence=evidence,
                warnings=[],
            )

        except Exception as exc:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=[f"Hazard bulletins provider failed: {str(exc)}"],
                error_code=ToolErrorCode.UPSTREAM_FAILURE.value,
            )

    @staticmethod
    def adapt_risk_evaluation(
        engine_fn: Callable[[ToolInvocationContext, MarineConditionsPayload, WeatherConditionsPayload, HazardBulletinPayload], RiskAssessmentPayload],
        context: ToolInvocationContext,
        marine: MarineConditionsPayload,
        weather: WeatherConditionsPayload,
        hazard: HazardBulletinPayload,
        is_mock: bool = False,
    ) -> ToolResult:
        """Adapts Dev 4 RiskEvaluationEngine output into normalized ToolResult."""
        try:
            payload = engine_fn(context, marine, weather, hazard)
            quality_flags = ["M2_CONTRACT_MOCK", "SIMULATED"] if is_mock else ["REAL_SOURCE", "DETERMINISTIC_EVAL"]

            rec = Recommendation(
                status=payload.status,
                summary=payload.summary,
                decisive_factors=payload.decisive_factors,
                next_action=payload.recommended_action,
            )
            confidence = Confidence(
                level=payload.confidence_level,
                reasons=payload.confidence_reasons,
            )

            evidence = [
                EvidenceItem(
                    source_name="SAMUDRA Risk Engine (Dev 4)",
                    retrieved_at=datetime.now(timezone.utc).isoformat(),
                    metric_name="risk_status",
                    metric_value=payload.status.value,
                    quality_flags=quality_flags,
                )
            ]

            data = payload.model_dump()
            data["recommendation"] = rec.model_dump()
            data["confidence"] = confidence.model_dump()

            return ToolResult(
                status=ToolStatus.OK,
                data=data,
                evidence=evidence,
                warnings=payload.warnings,
            )

        except Exception as exc:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=[f"Risk evaluation engine failed: {str(exc)}"],
                error_code=ToolErrorCode.INVALID_RESULT.value,
            )

    @staticmethod
    def adapt_pfz_ranking(
        engine_fn: Callable[[ToolInvocationContext, List[Dict[str, Any]]], PFZRankingPayload],
        context: ToolInvocationContext,
        raw_features: List[Dict[str, Any]],
        is_mock: bool = False,
    ) -> ToolResult:
        """Adapts Dev 4 PFZRankingEngine output into normalized ToolResult."""
        try:
            payload = engine_fn(context, raw_features)
            quality_flags = ["M2_CONTRACT_MOCK", "SIMULATED"] if is_mock else ["REAL_SOURCE", "GEOSPATIAL_EVAL"]

            evidence: List[EvidenceItem] = []
            if payload.ranked_candidates:
                top_cand = payload.ranked_candidates[0]
                evidence.append(
                    EvidenceItem(
                        source_name="PFZ Ranking Engine (Dev 4)",
                        retrieved_at=datetime.now(timezone.utc).isoformat(),
                        metric_name="pfz_distance_nm",
                        metric_value=top_cand.distance_nautical_miles,
                        metric_unit="nautical_miles",
                        quality_flags=quality_flags,
                    )
                )

            return ToolResult(
                status=ToolStatus.OK,
                data=payload.model_dump(),
                evidence=evidence,
                warnings=[],
            )

        except Exception as exc:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=[f"PFZ ranking engine failed: {str(exc)}"],
                error_code=ToolErrorCode.UPSTREAM_FAILURE.value,
            )

    @staticmethod
    def adapt_route_exposure(
        engine_fn: Callable[[ToolInvocationContext, MarineConditionsPayload, str], RouteExposurePayload],
        context: ToolInvocationContext,
        marine: MarineConditionsPayload,
        destination: str,
        is_mock: bool = False,
    ) -> ToolResult:
        """Adapts Dev 4 RouteExposureEngine output into normalized ToolResult."""
        try:
            payload = engine_fn(context, marine, destination)
            quality_flags = ["M2_CONTRACT_MOCK", "SIMULATED"] if is_mock else ["REAL_SOURCE", "ROUTE_EVAL"]

            evidence = [
                EvidenceItem(
                    source_name="Route Exposure Engine (Dev 4)",
                    retrieved_at=datetime.now(timezone.utc).isoformat(),
                    metric_name="recommended_route_id",
                    metric_value=payload.recommended_route_id,
                    quality_flags=quality_flags,
                )
            ]

            return ToolResult(
                status=ToolStatus.OK,
                data=payload.model_dump(),
                evidence=evidence,
                warnings=[],
            )

        except Exception as exc:
            return ToolResult(
                status=ToolStatus.FAILED,
                data={},
                evidence=[],
                warnings=[f"Route exposure engine failed: {str(exc)}"],
                error_code=ToolErrorCode.UPSTREAM_FAILURE.value,
            )
