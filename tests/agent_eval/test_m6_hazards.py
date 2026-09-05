"""Test Suite for Milestone M6 (Complete M6.1 -> M6.8: Hazard & Geofence Flow).

Comprehensive coverage for all 28 required test cases:
1. Hazard intent classification (preserve existing M6.1 coverage)
2. Geofence intent classification
3. Hazard tool selection
4. Geofence tool selection
5. Explicit origin/destination extraction
6. Route context resolution from M4 memory
7. Missing route -> clarification node
8. Explicit route override
9. Hazard-only flow
10. Geofence-only flow
11. Route hazard flow
12. Combined hazard + geofence flow
13. Hard-stop -> NO_GO enforcement
14. Restricted zone -> CAUTION enforcement
15. LLM cannot soften hard stop (PromptInjectionGuard)
16. Hazard dependency failure handling
17. Geofence dependency failure handling
18. Partial dependency failure handling
19. Evidence grounding (EvidenceValidator)
20. Combined evidence grounding
21. Multi-turn route carry-forward
22. Fresh domain evaluation (no stale domain caching)
23. English hazard/geofence response
24. Hindi hazard/geofence response
25. Marathi hazard/geofence response
26. LLM cannot directly call unregistered tools
27. Thread isolation
28. Existing M5 safety regression verification
"""

import pytest

from backend.app.agents.evidence import EvidenceValidator
from backend.app.agents.graph import (
    clarification_node,
    intent_locale_node,
    run_orca_graph,
    supervisor_node,
)
from backend.app.agents.integrations.mocks import (
    MockGeospatialHazardEngine,
    MockHazardProvider,
    register_m2_contract_mocks,
)
from backend.app.agents.intent import IntentCategory
from backend.app.agents.memory import memory_manager
from backend.app.agents.security import PromptInjectionGuard
from backend.app.agents.tools import tool_registry
from backend.app.contracts.chat import (
    EvidenceItem,
    RecommendationStatus,
)


@pytest.fixture(autouse=True)
def reset_contract_mocks():
    """Ensure standard contract mocks are cleanly registered before each test."""
    register_m2_contract_mocks(tool_registry, override=True)
    yield
    register_m2_contract_mocks(tool_registry, override=True)


# =============================================================================
# 1. Hazard Intent Classification
# =============================================================================

def test_01_hazard_intent_classification():
    """Verify hazard, cyclone, storm, and squall queries classify as HAZARDS."""
    queries = [
        ("Are there any hazards near Ratnagiri?", "Ratnagiri"),
        ("Are there any cyclone risks near Ratnagiri?", "Ratnagiri"),
        ("Are there any storm warnings?", None),
        ("Is there any squall alert off Mumbai?", "Mumbai"),
        ("Are there any hazards near me?", None),
    ]
    for q, expected_harbor in queries:
        state = {
            "user_message": q,
            "thread_id": "test-m6-intent-hazard",
            "tool_mode": "contract_mock",
        }
        res = intent_locale_node(state)
        assert res["intent"] == IntentCategory.HAZARDS.value
        if expected_harbor:
            assert res["origin_harbor"] == expected_harbor


# =============================================================================
# 2. Geofence Intent Classification
# =============================================================================

def test_02_geofence_intent_classification():
    """Verify restricted area, boundary, and geofence queries classify appropriately."""
    queries = [
        "Are there any restricted zones near Ratnagiri?",
        "Is this area inside a marine protected area?",
        "Are there any naval firing zones nearby?",
        "Is my departure point near a restricted area?",
        "Are there geofence boundaries off Goa?",
    ]
    for q in queries:
        state = {
            "user_message": q,
            "thread_id": "test-m6-intent-geofence",
            "tool_mode": "contract_mock",
        }
        res = intent_locale_node(state)
        assert res["intent"] in [IntentCategory.HAZARDS.value, IntentCategory.ROUTE.value]


# =============================================================================
# 3. Hazard Tool Selection
# =============================================================================

def test_03_hazard_tool_selection():
    """Verify supervisor selects only 'hazard_search' for hazard-only queries."""
    state = {
        "intent": IntentCategory.HAZARDS.value,
        "user_message": "Are there any cyclone warnings near Goa?",
        "origin_harbor": "Goa",
        "destination": None,
        "tool_mode": "contract_mock",
        "trace": [],
    }
    res = supervisor_node(state)
    assert res["task_plan"] == ["hazard_search"]


# =============================================================================
# 4. Geofence Tool Selection
# =============================================================================

def test_04_geofence_tool_selection():
    """Verify supervisor selects 'geospatial_hazard' capability for geofence queries."""
    state = {
        "intent": IntentCategory.HAZARDS.value,
        "user_message": "Are there restricted zones near Goa?",
        "origin_harbor": "Goa",
        "destination": None,
        "tool_mode": "contract_mock",
        "trace": [],
    }
    res = supervisor_node(state)
    assert res["task_plan"] == ["geospatial_hazard"]


# =============================================================================
# 5. Explicit Origin/Destination Extraction
# =============================================================================

def test_05_explicit_origin_destination_extraction():
    """Verify explicit origin and destination are cleanly parsed from the query."""
    state = {
        "user_message": "Are there any hazards on my route from Mumbai to Goa?",
        "thread_id": "test-m6-extract-route",
        "tool_mode": "contract_mock",
    }
    res = intent_locale_node(state)
    assert res["origin_harbor"] == "Mumbai"
    assert res["destination"] == "Goa"
    assert res["clarification_needed"] is False


# =============================================================================
# 6. Route Context Resolution from M4 Memory
# =============================================================================

def test_06_route_context_from_m4_memory():
    """Verify turn 2 inherits origin and destination from turn 1 via MemoryManager."""
    thread_id = "test-m6-route-memory"
    # Turn 1
    t1 = run_orca_graph(
        user_message="Check hazards from Mumbai to Goa.",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert t1["origin_harbor"] == "Mumbai"
    assert t1["destination"] == "Goa"

    # Turn 2: Follow-up query without explicit route
    t2 = run_orca_graph(
        user_message="What about restricted areas?",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert t2["origin_harbor"] == "Mumbai"
    assert t2["destination"] == "Goa"
    assert t2["clarification_needed"] is False


# =============================================================================
# 7. Missing Route -> Clarification
# =============================================================================

def test_07_missing_route_clarification():
    """Verify route query without origin or destination routes to clarification and never defaults to Ratnagiri."""
    state = {
        "user_message": "Are there restricted zones along my route?",
        "thread_id": "test-m6-missing-route",
        "tool_mode": "contract_mock",
    }
    res = intent_locale_node(state)
    assert res["clarification_needed"] is True
    assert "destination" in res["missing_fields"] or "origin_harbor" in res["missing_fields"]

    # Verify clarification node responds with localized query prompt
    clar_res = clarification_node(res)
    assert "?" in clar_res["response"]
    assert "route" in clar_res["response"].lower() or "destination" in clar_res["response"].lower()


# =============================================================================
# 8. Explicit Route Override
# =============================================================================

def test_08_explicit_route_override():
    """Verify turn 3 explicitly overriding origin updates memory correctly."""
    thread_id = "test-m6-route-override"
    # Turn 1
    run_orca_graph(
        user_message="Check hazards from Mumbai to Goa.",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )

    # Turn 2: Explicit correction
    t2 = run_orca_graph(
        user_message="Actually, I'm going from Ratnagiri to Goa.",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert t2["origin_harbor"] == "Ratnagiri"
    assert t2["destination"] == "Goa"


# =============================================================================
# 9. Hazard-Only Flow
# =============================================================================

def test_09_hazard_only_flow():
    """Verify hazard-only query executes hazard_search and returns valid bulletin."""
    res = run_orca_graph(
        user_message="Are there any cyclone warnings near Goa?",
        thread_id="test-m6-hazard-only",
        tool_mode="contract_mock",
    )
    assert res["task_plan"] == ["hazard_search"]
    assert "hazard_search" in res["tool_results"]
    assert res["risk_assessment"].status in [RecommendationStatus.INFORMATIONAL, RecommendationStatus.NO_GO]


# =============================================================================
# 10. Geofence-Only Flow
# =============================================================================

def test_10_geofence_only_flow():
    """Verify geofence-only query executes geospatial_hazard."""
    res = run_orca_graph(
        user_message="Are there restricted zones near Goa?",
        thread_id="test-m6-geofence-only",
        tool_mode="contract_mock",
    )
    assert "geospatial_hazard" in res["task_plan"]
    assert "geospatial_hazard" in res["tool_results"]


# =============================================================================
# 11. Route Hazard Flow
# =============================================================================

def test_11_route_hazard_flow():
    """Verify route hazard query orchestrates hazard_search and route_analysis."""
    res = run_orca_graph(
        user_message="Are there cyclone risks on my route from Mumbai to Goa?",
        thread_id="test-m6-route-hazard",
        tool_mode="contract_mock",
    )
    assert "hazard_search" in res["task_plan"]
    assert "route_analysis" in res["task_plan"]


# =============================================================================
# 12. Combined Hazard + Geofence Flow
# =============================================================================

def test_12_combined_hazard_geofence_flow():
    """Verify combined query orchestrates hazard_search, geospatial_hazard, and route_analysis."""
    res = run_orca_graph(
        user_message="Are there any cyclone or restricted-zone risks on my route from Mumbai to Goa?",
        thread_id="test-m6-combined-flow",
        tool_mode="contract_mock",
    )
    assert "hazard_search" in res["task_plan"]
    assert "geospatial_hazard" in res["task_plan"]
    assert "route_analysis" in res["task_plan"]
    assert "hazard_search" in res["tool_results"]
    assert "geospatial_hazard" in res["tool_results"]


# =============================================================================
# 13. Hard-Stop Enforcement -> NO_GO
# =============================================================================

def test_13_hard_stop_enforcement_no_go():
    """Verify that a hard stop boundary violation strictly forces RecommendationStatus.NO_GO."""
    register_m2_contract_mocks(
        tool_registry,
        mock_geospatial=MockGeospatialHazardEngine(
            hard_stop=True,
            restricted=True,
            intersected=True,
            restriction_name="Naval Firing Zone Alpha",
        ),
        override=True,
    )
    res = run_orca_graph(
        user_message="Are there restricted zones near Ratnagiri?",
        thread_id="test-m6-hard-stop",
        tool_mode="contract_mock",
    )
    assert res["risk_assessment"].status == RecommendationStatus.NO_GO
    assert "[NO_GO]" in res["response"]
    assert "prohibited" in res["response"].lower() or "forbidden" in res["response"].lower()


# =============================================================================
# 14. Restricted Zone Enforcement -> CAUTION
# =============================================================================

def test_14_restricted_zone_enforcement_caution():
    """Verify that a restricted boundary without hard stop produces RecommendationStatus.CAUTION."""
    register_m2_contract_mocks(
        tool_registry,
        mock_geospatial=MockGeospatialHazardEngine(
            hard_stop=False,
            restricted=True,
            intersected=True,
            restriction_name="Marine Sanctuary Buffer",
        ),
        override=True,
    )
    res = run_orca_graph(
        user_message="Are there restricted zones near Ratnagiri?",
        thread_id="test-m6-caution-zone",
        tool_mode="contract_mock",
    )
    assert res["risk_assessment"].status == RecommendationStatus.CAUTION
    assert "[CAUTION]" in res["response"]


# =============================================================================
# 15. LLM Cannot Soften Hard Stop
# =============================================================================

def test_15_llm_cannot_soften_hard_stop():
    """Verify PromptInjectionGuard blocks prohibited phrases attempting to soften NO_GO/CAUTION status."""
    prohibited_drafts = [
        "the route should probably be fine despite the warning",
        "you can proceed carefully through the naval zone",
        "the restriction can be ignored for small crafts",
        "safe to proceed through the restricted area",
        "conditions are safe, safe to proceed",
    ]
    for draft in prohibited_drafts:
        is_valid, reason = PromptInjectionGuard.audit_response_for_tampering(
            draft,
            RecommendationStatus.NO_GO,
        )
        assert is_valid is False
        assert reason is not None


# =============================================================================
# 16. Hazard Dependency Failure
# =============================================================================

def test_16_hazard_dependency_failure():
    """Verify graceful handling and conservative UNKNOWN status when hazard_search fails."""
    register_m2_contract_mocks(
        tool_registry,
        mock_hazard=MockHazardProvider(should_fail=True),
        override=True,
    )
    res = run_orca_graph(
        user_message="Are there any cyclone warnings near Ratnagiri?",
        thread_id="test-m6-hazard-fail",
        tool_mode="contract_mock",
    )
    assert res["risk_assessment"].status == RecommendationStatus.UNKNOWN
    assert "[UNKNOWN]" in res["response"]
    assert "hazard_search" in res.get("failed_tools", [])


# =============================================================================
# 17. Geofence Dependency Failure
# =============================================================================

def test_17_geofence_dependency_failure():
    """Verify graceful handling and conservative UNKNOWN status when geospatial_hazard fails."""
    register_m2_contract_mocks(
        tool_registry,
        mock_geospatial=MockGeospatialHazardEngine(should_fail=True),
        override=True,
    )
    res = run_orca_graph(
        user_message="Are there restricted zones near Ratnagiri?",
        thread_id="test-m6-geofence-fail",
        tool_mode="contract_mock",
    )
    assert res["risk_assessment"].status == RecommendationStatus.UNKNOWN
    assert "[UNKNOWN]" in res["response"]
    assert "geospatial_hazard" in res.get("failed_tools", [])


# =============================================================================
# 18. Partial Dependency Failure
# =============================================================================

def test_18_partial_dependency_failure():
    """Verify that in combined flow, if one tool fails, the successful tool result is preserved and missing part is reported."""
    register_m2_contract_mocks(
        tool_registry,
        mock_hazard=MockHazardProvider(cyclone_active=False, squall_alert=False),
        mock_geospatial=MockGeospatialHazardEngine(should_fail=True),
        override=True,
    )
    res = run_orca_graph(
        user_message="Are there cyclone or restricted-zone risks on my route from Mumbai to Goa?",
        thread_id="test-m6-partial-fail",
        tool_mode="contract_mock",
    )
    assert res["risk_assessment"].status == RecommendationStatus.UNKNOWN
    # Successful hazard search observations are preserved
    assert res["observations"].get("cyclone_warning_active") is False
    # Geospatial hazard failed and is reported
    assert "geospatial_hazard" in res.get("failed_tools", [])
    assert "unavailable" in res["response"].lower() or "incomplete" in res["response"].lower()


# =============================================================================
# 19. Evidence Grounding
# =============================================================================

def test_19_evidence_grounding():
    """Verify EvidenceValidator audits critical hazard and geofence metrics correctly."""
    valid_evidence = [
        EvidenceItem(
            source_name="IMD Hazard Bulletin",
            retrieved_at="2026-09-05T12:00:00Z",
            metric_name="cyclone_warning_active",
            metric_value=False,
            quality_flags=["OFFICIAL"],
        ),
        EvidenceItem(
            source_name="Geospatial Hazard Engine",
            retrieved_at="2026-09-05T12:00:00Z",
            metric_name="geofence_intersection",
            metric_value="False",
            quality_flags=["GEOSPATIAL_EVAL"],
        ),
    ]
    report = EvidenceValidator.audit_evidence(
        valid_evidence,
        ["cyclone_warning_active", "geofence_intersection"],
    )
    assert report.is_valid is True

    # Missing critical metric triggers invalid report
    partial_evidence = [valid_evidence[0]]
    invalid_report = EvidenceValidator.audit_evidence(
        partial_evidence,
        ["cyclone_warning_active", "geofence_intersection"],
    )
    assert invalid_report.is_valid is False
    assert "geofence_intersection" in invalid_report.unverified_claims


# =============================================================================
# 20. Combined Evidence Grounding
# =============================================================================

def test_20_combined_evidence_grounding():
    """Verify combined route query gathers distinct evidence citations from all executed tools."""
    res = run_orca_graph(
        user_message="Are there cyclone or restricted-zone risks on my route from Mumbai to Goa?",
        thread_id="test-m6-combined-evidence",
        tool_mode="contract_mock",
    )
    evidence = res.get("evidence", [])
    metric_names = [e.metric_name for e in evidence]
    assert "cyclone_warning_active" in metric_names
    assert "geofence_intersection" in metric_names
    assert "recommended_route_id" in metric_names


# =============================================================================
# 21. Multi-Turn Route Carry-Forward
# =============================================================================

def test_21_multi_turn_route_carry_forward():
    """Verify origin and destination survive multiple intermediate conversational turns."""
    thread_id = "test-m6-multiturn-carry"
    ctx = memory_manager.load_context(thread_id)
    ctx.active_harbor = "Mumbai"
    ctx.destination = "Goa"
    memory_manager.save_context(ctx)

    res = run_orca_graph(
        user_message="Are there any hazards along the route?",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert res["origin_harbor"] == "Mumbai"
    assert res["destination"] == "Goa"


# =============================================================================
# 22. Fresh Domain Evaluation
# =============================================================================

def test_22_fresh_domain_evaluation():
    """Verify that subsequent turns perform fresh domain evaluations rather than reusing stale status."""
    thread_id = "test-m6-fresh-eval"
    # Turn 1: Normal conditions
    t1 = run_orca_graph(
        user_message="Are there hazards from Mumbai to Goa?",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert t1["risk_assessment"].status == RecommendationStatus.INFORMATIONAL

    # Turn 2: Cyclone strikes
    register_m2_contract_mocks(
        tool_registry,
        mock_hazard=MockHazardProvider(cyclone_active=True),
        override=True,
    )
    t2 = run_orca_graph(
        user_message="Are there hazards from Mumbai to Goa?",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert t2["risk_assessment"].status == RecommendationStatus.NO_GO
    assert t2["observations"]["cyclone_warning_active"] is True


# =============================================================================
# 23. English Hazard / Geofence Response
# =============================================================================

def test_23_english_hazard_geofence_response():
    """Verify English response format contains status tag, decisive factors, and evidence citations."""
    res = run_orca_graph(
        user_message="Are there restricted zones on my route from Mumbai to Goa?",
        thread_id="test-m6-lang-en",
        tool_mode="contract_mock",
    )
    assert "[INFORMATIONAL]" in res["response"] or "[CAUTION]" in res["response"]
    assert "Key Decisive Factors:" in res["response"]
    assert "Supporting Evidence:" in res["response"]


# =============================================================================
# 24. Hindi Hazard / Geofence Response
# =============================================================================

def test_24_hindi_hazard_geofence_response():
    """Verify Hindi response format preserves invariant status tag and localizes content."""
    res = run_orca_graph(
        user_message="मुंबई से गोवा के रास्ते में क्या कोई चक्रवात या प्रतिबंधित क्षेत्र है?",
        thread_id="test-m6-lang-hi",
        tool_mode="contract_mock",
    )
    assert res["language"] == "hi"
    assert "[INFORMATIONAL]" in res["response"] or "[CAUTION]" in res["response"]
    assert "प्रमुख निर्णायक कारक:" in res["response"]
    assert "साक्ष्य आधार:" in res["response"]


# =============================================================================
# 25. Marathi Hazard / Geofence Response
# =============================================================================

def test_25_marathi_hazard_geofence_response():
    """Verify Marathi response format preserves invariant status tag and localizes content."""
    res = run_orca_graph(
        user_message="मुंबई ते गोवा मार्गावर काही चक्रीवादळ किंवा प्रतिबंधित क्षेत्रे आहेत का?",
        thread_id="test-m6-lang-mr",
        tool_mode="contract_mock",
    )
    assert res["language"] == "mr"
    assert "[INFORMATIONAL]" in res["response"] or "[CAUTION]" in res["response"]
    assert "महत्त्वाचे घटक:" in res["response"]
    assert "पुरावा आधार:" in res["response"]


# =============================================================================
# 26. LLM Cannot Directly Call Unregistered Tools
# =============================================================================

def test_26_llm_cannot_directly_call_unregistered_tools():
    """Verify that unregistered capabilities are rejected and trigger capability fallback."""
    state = {
        "intent": IntentCategory.HAZARDS.value,
        "task_plan": ["unregistered_alien_sensor"],
        "user_message": "Check alien hazards",
        "tool_mode": "contract_mock",
        "trace": [],
    }
    # Direct execution should not fail silently or execute arbitrary code
    res = supervisor_node(state)
    # The supervisor only selects registered capabilities
    for tool_name in res["task_plan"]:
        assert tool_registry.is_capability_available(tool_name) or tool_registry.get_tool(tool_name) is not None


# =============================================================================
# 27. Thread Isolation
# =============================================================================

def test_27_thread_isolation():
    """Verify that state and route memory in thread A do not leak into thread B."""
    tA = run_orca_graph(
        user_message="Check hazards from Mumbai to Goa.",
        thread_id="thread-A-isolated",
        tool_mode="contract_mock",
    )
    assert tA["origin_harbor"] == "Mumbai"
    assert tA["destination"] == "Goa"

    # Thread B asks a fresh ungrounded question
    tB = run_orca_graph(
        user_message="Are there restricted zones along my route?",
        thread_id="thread-B-isolated",
        tool_mode="contract_mock",
    )
    # Thread B must require clarification and not inherit Mumbai/Goa from Thread A
    assert tB["clarification_needed"] is True
    assert tB.get("destination") is None


# =============================================================================
# 28. Existing M5 Safety Regression Verification
# =============================================================================

def test_28_existing_m5_safety_regression():
    """Verify that existing M5 safety flow behaves identically with intact DAG execution."""
    res = run_orca_graph(
        user_message="Can I go fishing tomorrow at 6 AM from Ratnagiri?",
        thread_id="test-m6-m5-regression",
        tool_mode="contract_mock",
    )
    assert res["intent"] == IntentCategory.SAFETY.value
    assert res["origin_harbor"] == "Ratnagiri"
    assert res["clarification_needed"] is False
    expected_plan = ["marine_conditions", "weather_conditions", "hazard_search", "risk_evaluation"]
    assert res["task_plan"] == expected_plan
    rec = res.get("risk_assessment")
    assert rec is not None
    assert rec.status in [
        RecommendationStatus.GO,
        RecommendationStatus.CAUTION,
        RecommendationStatus.NO_GO,
    ]
