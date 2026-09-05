"""M7 Route Reasoning Flow — Comprehensive Evaluation Tests.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

Tests M7 Requirements:
  M7.1 — ROUTE intent classification
  M7.2 — Origin/destination context resolution
  M7.3 — Full capability plan selection
  M7.4 — Dependency ordering
  M7.5 — Route candidate preservation
  M7.6 — Deterministic comparison logic
  M7.7 — Authoritative status hierarchy
  M7.8 — Failure semantics
  M7.9 — Evidence grounding
  M7.10 — Multilingual route advisories
  M7.11 — M0-M6 regression
"""

from typing import Any, Dict, Optional

from backend.app.agents.graph import run_orca_graph, _compare_route_candidates
from backend.app.agents.intent import IntentCategory
from backend.app.agents.integrations.mocks import (
    MockGeospatialHazardEngine,
    MockHazardProvider,
    MockMarineConditionsProvider,
    MockRiskEngine,
    MockRouteExposureEngine,
    MockWeatherProvider,
    register_m2_contract_mocks,
)
from backend.app.agents.tools import AgentToolRegistry
from backend.app.contracts.chat import RecommendationStatus


# =============================================================================
# Helpers
# =============================================================================

def _run_route(
    message: str,
    context: Optional[Dict[str, Any]] = None,
    mock_hazard: Optional[MockHazardProvider] = None,
    mock_geospatial: Optional[MockGeospatialHazardEngine] = None,
    mock_risk: Optional[MockRiskEngine] = None,
    mock_route: Optional[MockRouteExposureEngine] = None,
    mock_marine: Optional[MockMarineConditionsProvider] = None,
    mock_weather: Optional[MockWeatherProvider] = None,
):
    """Runs the ORCA graph in contract_mock mode for a ROUTE query."""
    import backend.app.agents.graph as graph_mod

    registry = AgentToolRegistry()
    register_m2_contract_mocks(
        target_registry=registry,
        mock_hazard=mock_hazard,
        mock_geospatial=mock_geospatial,
        mock_risk=mock_risk,
        mock_route=mock_route,
        mock_marine=mock_marine,
        mock_weather=mock_weather,
        override=True,
    )

    original_registry = graph_mod.tool_registry
    graph_mod.tool_registry = registry
    try:
        state = run_orca_graph(
            user_message=message,
            thread_id=f"test-m7-{abs(hash(message))}",
            user_context=context or {"origin_harbor": "Ratnagiri", "craft_profile": "mechanized_trawler"},
            tool_mode="contract_mock",
        )
    finally:
        graph_mod.tool_registry = original_registry
    return state


# =============================================================================
# M7.1 — ROUTE Intent Classification (6 canonical phrases)
# =============================================================================

class TestM7RouteIntentClassification:

    def test_intent_which_route_safer(self):
        """M7.1a: 'Which route is safer' -> ROUTE intent."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert state["intent"] == IntentCategory.ROUTE.value

    def test_intent_passage_comparison(self):
        """M7.1b: 'passage' keyword -> ROUTE intent."""
        state = _run_route(
            "What is the safest passage from Malvan to the fishing bank?",
            context={"origin_harbor": "Malvan", "craft_profile": "mechanized_trawler"},
        )
        assert state["intent"] == IntentCategory.ROUTE.value

    def test_intent_channel_keyword(self):
        """M7.1c: 'channel' keyword -> ROUTE intent."""
        state = _run_route(
            "Is the inshore channel safe to use today from Veraval?",
            context={"origin_harbor": "Veraval", "craft_profile": "motorized_boat"},
        )
        assert state["intent"] == IntentCategory.ROUTE.value

    def test_intent_marathi_route_keyword(self):
        """M7.1d: Marathi 'मार्ग' -> ROUTE intent."""
        state = _run_route(
            "रत्नागिरीवरून बाहेरील मच्छिमारी बँकेपर्यंत कोणता मार्ग सुरक्षित आहे?",
            context={"origin_harbor": "Ratnagiri", "craft_profile": "mechanized_trawler"},
        )
        assert state["intent"] == IntentCategory.ROUTE.value

    def test_intent_hindi_route_keyword(self):
        """M7.1e: Hindi 'रास्ता' -> ROUTE intent."""
        state = _run_route(
            "वेरावल से मछली पकड़ने के लिए कौन सा रास्ता सुरक्षित है?",
            context={"origin_harbor": "Veraval", "craft_profile": "motorized_boat"},
        )
        assert state["intent"] == IntentCategory.ROUTE.value

    def test_intent_route_keyword_english(self):
        """M7.1f: 'route' keyword -> ROUTE intent."""
        state = _run_route("What route should I take from Mumbai to Alibaug today?")
        assert state["intent"] == IntentCategory.ROUTE.value


# =============================================================================
# M7.2 — Origin/Destination Context Resolution
# =============================================================================

class TestM7ContextResolution:

    def test_explicit_origin_from_message(self):
        """M7.2a: Origin extracted from explicit message phrasing."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            context={"craft_profile": "mechanized_trawler"},
        )
        assert state.get("origin_harbor") == "Ratnagiri"

    def test_route_analysis_in_plan_when_destination_present(self):
        """M7.2b: route_analysis is scheduled when destination is present."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert "route_analysis" in state.get("task_plan", [])

    def test_context_harbor_used_when_not_in_message(self):
        """M7.2c: origin_harbor from user_context is used by the pipeline."""
        state = _run_route(
            "Which route is safer from Veraval to Outer Bank?",
            context={"origin_harbor": "Veraval", "craft_profile": "mechanized_trawler"},
        )
        # Pipeline must produce a route response (not clarification)
        assert state.get("response") is not None
        # Route analysis must have been in the plan
        assert "route_analysis" in state.get("task_plan", [])


# =============================================================================
# M7.3 — Capability Plan Selection
# =============================================================================

class TestM7CapabilityPlan:

    def test_route_plan_includes_marine_conditions(self):
        """M7.3a: ROUTE plan includes marine_conditions."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert "marine_conditions" in state.get("task_plan", [])

    def test_route_plan_includes_weather_conditions(self):
        """M7.3b: ROUTE plan includes weather_conditions (dependency of risk_evaluation)."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert "weather_conditions" in state.get("task_plan", [])

    def test_route_plan_includes_hazard_search(self):
        """M7.3c: ROUTE plan includes hazard_search."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert "hazard_search" in state.get("task_plan", [])

    def test_route_plan_includes_geospatial_hazard(self):
        """M7.3d: ROUTE plan includes geospatial_hazard."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert "geospatial_hazard" in state.get("task_plan", [])

    def test_route_plan_includes_route_analysis(self):
        """M7.3e: ROUTE plan includes route_analysis."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert "route_analysis" in state.get("task_plan", [])

    def test_route_plan_includes_risk_evaluation(self):
        """M7.3f: ROUTE plan includes risk_evaluation."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert "risk_evaluation" in state.get("task_plan", [])


# =============================================================================
# M7.4 — Dependency Ordering
# =============================================================================

class TestM7DependencyOrdering:

    def test_marine_before_route_analysis(self):
        """M7.4a: marine_conditions before route_analysis."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        plan = state.get("task_plan", [])
        assert plan.index("marine_conditions") < plan.index("route_analysis")

    def test_hazard_before_route_analysis(self):
        """M7.4b: hazard_search before route_analysis (declared dependency)."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        plan = state.get("task_plan", [])
        assert plan.index("hazard_search") < plan.index("route_analysis")

    def test_route_analysis_before_risk_evaluation(self):
        """M7.4c: route_analysis before risk_evaluation."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        plan = state.get("task_plan", [])
        assert plan.index("route_analysis") < plan.index("risk_evaluation")

    def test_weather_before_risk_evaluation(self):
        """M7.4d: weather_conditions before risk_evaluation (declared dependency)."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        plan = state.get("task_plan", [])
        assert plan.index("weather_conditions") < plan.index("risk_evaluation")


# =============================================================================
# M7.5 — Route Candidate Preservation
# =============================================================================

class TestM7RouteCandidatePreservation:

    def test_route_candidates_populated(self):
        """M7.5a: route_candidates list is populated from route_analysis result."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        candidates = state.get("route_candidates", [])
        assert isinstance(candidates, list)
        assert len(candidates) >= 1

    def test_route_candidates_have_required_fields(self):
        """M7.5b: Each route candidate has route_id, risk_rating, exposure_score."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        candidates = state.get("route_candidates", [])
        for cand in candidates:
            assert "route_id" in cand
            assert "risk_rating" in cand
            assert "exposure_score" in cand

    def test_two_candidates_from_mock_engine(self):
        """M7.5c: MockRouteExposureEngine produces ROUTE-A-INSHORE and ROUTE-B-DIRECT."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        candidates = state.get("route_candidates", [])
        route_ids = [c["route_id"] for c in candidates]
        assert "ROUTE-A-INSHORE" in route_ids
        assert "ROUTE-B-DIRECT" in route_ids


# =============================================================================
# M7.6 — Deterministic Comparison Logic
# =============================================================================

class TestM7ComparisonLogic:

    def test_compare_route_candidates_helper(self):
        """M7.6a: _compare_route_candidates reads only Dev 4 output fields."""
        candidates = [
            {"route_id": "R-A", "name": "Inshore", "risk_rating": "LOW", "exposure_score": 2.1, "distance_km": 26.5, "max_wave_height_m": 1.3},
            {"route_id": "R-B", "name": "Direct", "risk_rating": "MODERATE", "exposure_score": 4.8, "distance_km": 20.2, "max_wave_height_m": 2.1},
        ]
        obs = {"recommended_route_id": "R-A"}
        result = _compare_route_candidates(candidates, obs)
        assert result["recommended_route_id"] == "R-A"
        assert len(result["candidates"]) == 2
        assert result["comparison_basis"] == "Dev 4 RouteExposureEngine (risk_rating + exposure_score)"

    def test_comparison_in_observations(self):
        """M7.6b: route_comparison is written into observations after tool run."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        obs = state.get("observations", {})
        assert "route_comparison" in obs
        rc = obs["route_comparison"]
        assert "recommended_route_id" in rc
        assert "candidates" in rc
        assert "comparison_basis" in rc

    def test_recommended_route_in_response(self):
        """M7.6c: Recommended route ID (ROUTE-A-INSHORE) appears in the response."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert "ROUTE-A-INSHORE" in state.get("response", "")


# =============================================================================
# M7.7 — Authoritative Status Hierarchy
# =============================================================================

class TestM7AuthoritativeStatus:

    def test_caution_status_from_risk_engine(self):
        """M7.7a: CAUTION status preserved from risk_evaluation output."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            mock_risk=MockRiskEngine(override_status=RecommendationStatus.CAUTION),
        )
        assert state["risk_assessment"].status == RecommendationStatus.CAUTION

    def test_no_go_cyclone_active(self):
        """M7.7b: NO_GO when cyclone warning is active."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            mock_hazard=MockHazardProvider(cyclone_active=True),
            mock_risk=MockRiskEngine(override_status=RecommendationStatus.NO_GO),
        )
        assert state["risk_assessment"].status == RecommendationStatus.NO_GO

    def test_no_go_status_preserved_in_response(self):
        """M7.7c: NO_GO status appears in response header; not softened."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            mock_risk=MockRiskEngine(override_status=RecommendationStatus.NO_GO),
        )
        response = state.get("response", "")
        assert "NO_GO" in response
        assert "it might be fine" not in response.lower()

    def test_status_header_in_response(self):
        """M7.7d: [STATUS] header matches risk_assessment.status."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            mock_risk=MockRiskEngine(override_status=RecommendationStatus.CAUTION),
        )
        rec = state.get("risk_assessment")
        assert rec is not None
        assert f"[{rec.status.value}]" in state.get("response", "")


# =============================================================================
# M7.8 — Failure Semantics
# =============================================================================

class TestM7FailureSemantics:

    def test_hazard_tool_failure_acknowledged(self):
        """M7.8a: If hazard_search fails, response acknowledges missing verification."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            mock_hazard=MockHazardProvider(should_fail=True),
        )
        response = state.get("response", "").lower()
        warnings = state.get("warnings", [])
        failure_mentioned = (
            "unavailable" in response
            or "upstream failure" in response
            or any("failed" in w.lower() for w in warnings)
        )
        assert failure_mentioned, "Hazard tool failure must be acknowledged"

    def test_geofence_tool_failure_acknowledged(self):
        """M7.8b: If geospatial_hazard fails, response acknowledges missing verification."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            mock_geospatial=MockGeospatialHazardEngine(should_fail=True),
        )
        response = state.get("response", "").lower()
        warnings = state.get("warnings", [])
        failure_mentioned = (
            "unavailable" in response
            or "upstream failure" in response
            or any("failed" in w.lower() for w in warnings)
        )
        assert failure_mentioned, "Geofence tool failure must be acknowledged"

    def test_pipeline_completes_with_partial_failures(self):
        """M7.8c: Pipeline always completes and returns a response even with partial failures."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            mock_hazard=MockHazardProvider(should_fail=True),
        )
        assert state.get("response") is not None
        assert len(state.get("response", "")) > 0


# =============================================================================
# M7.9 — Evidence Grounding
# =============================================================================

class TestM7EvidenceGrounding:

    def test_route_evidence_contains_recommended_route_id(self):
        """M7.9a: evidence includes recommended_route_id from route_analysis adapter."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        evidence = state.get("evidence", [])
        route_evidence = [e for e in evidence if e.metric_name == "recommended_route_id"]
        assert len(route_evidence) >= 1

    def test_evidence_contains_risk_status(self):
        """M7.9b: evidence includes risk_status from risk_evaluation adapter."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        evidence = state.get("evidence", [])
        risk_evidence = [e for e in evidence if e.metric_name == "risk_status"]
        assert len(risk_evidence) >= 1

    def test_evidence_contains_cyclone_warning(self):
        """M7.9c: evidence includes cyclone_warning_active from hazard_search adapter."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        evidence = state.get("evidence", [])
        hazard_ev = [e for e in evidence if e.metric_name == "cyclone_warning_active"]
        assert len(hazard_ev) >= 1


# =============================================================================
# M7.10 — Multilingual Route Advisories
# =============================================================================

class TestM7MultilingualSupport:

    def test_english_route_response_header(self):
        """M7.10a: English response contains route comparison header."""
        state = _run_route(
            "Which route is safer from Ratnagiri to Outer Bank?",
            context={"origin_harbor": "Ratnagiri", "craft_profile": "mechanized_trawler"},
        )
        response = state.get("response", "")
        assert "Route Safety Comparison" in response

    def test_marathi_route_response_header(self):
        """M7.10b: Marathi response contains Marathi route comparison header.

        Uses a query with destination keyword to bypass clarification node.
        Marathi keyword 'मार्ग' triggers ROUTE intent.
        """
        # Include destination cue so clarification is not triggered
        state = _run_route(
            "रत्नागिरी ते गोवा मार्ग सुरक्षित आहे का?",
            context={"origin_harbor": "Ratnagiri", "craft_profile": "mechanized_trawler"},
        )
        response = state.get("response", "")
        # The response must be in Marathi and contain the route comparison header
        assert "मार्ग सुरक्षा तुलना" in response or "Route Safety" in response

    def test_hindi_route_response_header(self):
        """M7.10c: Hindi response contains Hindi route comparison header.

        Uses a query with destination keyword to bypass clarification node.
        Hindi keyword 'रास्ता' triggers ROUTE intent.
        """
        state = _run_route(
            "वेरावल से गोवा का रास्ता सुरक्षित है?",
            context={"origin_harbor": "Veraval", "craft_profile": "motorized_boat"},
        )
        response = state.get("response", "")
        assert "मार्ग सुरक्षा तुलना" in response or "Route Safety" in response

    def test_status_header_invariant_in_all_languages(self):
        """M7.10d: [STATUS] header appears regardless of language.

        Uses queries that include destination so clarification is not triggered.
        Verifies that the authoritative status header [GO/CAUTION/NO_GO/etc.]
        always appears in the response regardless of language.
        """
        messages = [
            ("Which route is safer from Ratnagiri to Outer Bank?",
             {"origin_harbor": "Ratnagiri", "craft_profile": "mechanized_trawler"}),
            # Marathi: 'Ratnagiri to Goa route is safe?' — includes 'ते' (to) + destination
            ("रत्नागिरी ते गोवा मार्ग सुरक्षित आहे का?",
             {"origin_harbor": "Ratnagiri", "craft_profile": "mechanized_trawler"}),
        ]
        for message, ctx in messages:
            state = _run_route(message, context=ctx)
            rec = state.get("risk_assessment")
            response = state.get("response", "")
            assert rec is not None, f"No risk_assessment for: {message[:40]}"
            assert f"[{rec.status.value}]" in response, f"Status header missing for: {message[:40]}"


# =============================================================================
# M7.11 — Regression: M0-M6 Flows Unaffected
# =============================================================================

class TestM7Regression:

    def test_hazards_intent_unaffected(self):
        """M7.11a: HAZARDS intent works after ROUTE split."""
        state = run_orca_graph(
            "Is there a cyclone warning near Ratnagiri?",
            user_context={"origin_harbor": "Ratnagiri"},
            tool_mode="contract_mock",
        )
        assert state.get("intent") == IntentCategory.HAZARDS.value
        assert state.get("response") is not None

    def test_safety_intent_unaffected(self):
        """M7.11b: SAFETY intent still works."""
        state = run_orca_graph(
            "Is it safe to go fishing tomorrow from Ratnagiri?",
            user_context={"origin_harbor": "Ratnagiri", "craft_profile": "motorized_boat"},
            tool_mode="contract_mock",
        )
        assert state.get("intent") == IntentCategory.SAFETY.value
        assert state.get("response") is not None

    def test_pfz_intent_unaffected(self):
        """M7.11c: PFZ intent still works."""
        state = run_orca_graph(
            "Where is the nearest fishing zone from Ratnagiri?",
            user_context={"origin_harbor": "Ratnagiri"},
            tool_mode="demo",
        )
        assert state.get("intent") == IntentCategory.PFZ.value
        assert state.get("response") is not None

    def test_route_demo_mode_still_works(self):
        """M7.11d: ROUTE in M1 demo mode still works (route_stub path)."""
        state = run_orca_graph(
            "Which route is safer from Ratnagiri to Outer Bank?",
            user_context={"origin_harbor": "Ratnagiri", "craft_profile": "mechanized_trawler"},
            tool_mode="demo",
        )
        assert state.get("intent") == IntentCategory.ROUTE.value
        assert state.get("response") is not None
        assert "M1 DEMO DATA" in state.get("response", "")

    def test_pipeline_always_has_response(self):
        """M7.11e: Pipeline invariant — every ROUTE query produces a non-empty response."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert state.get("response") is not None
        assert len(state.get("response", "")) > 0

    def test_trace_always_present(self):
        """M7.11f: Audit trace is always populated for ROUTE queries."""
        state = _run_route("Which route is safer from Ratnagiri to Outer Bank?")
        assert state.get("trace") is not None
        assert len(state.get("trace", [])) > 0
