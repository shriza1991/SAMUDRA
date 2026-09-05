"""M5 Safety Reasoning Flow Test Suite.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

Validates the complete M5 Safety Reasoning Flow:
1. Basic end-to-end Safety Flow (Intent -> Supervisor -> Marine/Weather/Hazard -> Risk -> Evidence -> Response -> Terminal)
2. Authoritative GO status preservation
3. Authoritative CAUTION status preservation
4. Authoritative NO_GO status preservation
5. Authoritative UNKNOWN status preservation on missing data
6. Safety Invariance Guardrail (Dev 4 decision cannot be altered or softened)
7. Strict DAG dependency order enforcement
8. Upstream Marine observation failure handling (conservative UNKNOWN, low confidence)
9. Upstream Weather observation failure handling (conservative UNKNOWN, low confidence)
10. Downstream Risk engine failure handling (conservative UNKNOWN, clear warning)
11. Fresh domain evaluation (multi-turn re-evaluation without stale caching)
12. Thread Context Carry Forward (inheriting departure harbor across turns)
13. Explicit Departure Harbor Override (overriding remembered harbor)
14. Evidence Grounding & Verification (critical metrics citation audit)
15. Multilingual Safety Advisory (Marathi/Hindi with invariant status header)
16. Architectural Isolation (No direct LLM tool invocation or fabrication)
"""

import pytest

from backend.app.agents.evidence import EvidenceValidator
from backend.app.agents.graph import (
    NodeId,
    build_orca_graph,
    run_orca_graph,
)
from backend.app.agents.integrations.contracts import ToolOwner
from backend.app.agents.integrations.mocks import (
    MockRiskEngine,
    register_m2_contract_mocks,
)
from backend.app.agents.intent import IntentCategory
from backend.app.agents.memory import memory_manager
from backend.app.agents.response import ResponseComposer
from backend.app.agents.security import PromptInjectionGuard
from backend.app.agents.tools import (
    ToolDefinition,
    ToolParameter,
    ToolResult,
    ToolStatus,
    tool_registry,
)
from backend.app.contracts.chat import (
    ChatResponse,
    Confidence,
    ConfidenceLevel,
    Recommendation,
    RecommendationStatus,
)


@pytest.fixture(autouse=True)
def reset_contract_mocks():
    """Ensure standard contract mocks are registered before each test."""
    register_m2_contract_mocks(tool_registry, override=True)
    yield
    register_m2_contract_mocks(tool_registry, override=True)


# =============================================================================
# Test 1: Basic End-to-End Safety Flow
# =============================================================================

def test_m5_safety_basic_flow():
    """Verify complete safety inquiry compiles and executes through all required nodes."""
    query = "Can I go fishing tomorrow at 6 AM from Ratnagiri?"
    state = run_orca_graph(query, tool_mode="contract_mock")

    assert state["intent"] == IntentCategory.SAFETY.value
    assert state.get("origin_harbor") == "Ratnagiri"
    assert state["clarification_needed"] is False

    # Verify task plan includes all safety capabilities in DAG order
    expected_plan = ["marine_conditions", "weather_conditions", "hazard_search", "risk_evaluation"]
    assert state["task_plan"] == expected_plan

    # Verify authoritative risk assessment was populated
    rec = state.get("risk_assessment")
    assert rec is not None
    assert rec.status in [
        RecommendationStatus.GO,
        RecommendationStatus.CAUTION,
        RecommendationStatus.NO_GO,
    ]
    assert rec.summary is not None
    assert len(rec.decisive_factors) > 0

    # Verify evidence items collected
    evidence = state.get("evidence", [])
    assert len(evidence) >= 3
    metric_names = [e.metric_name for e in evidence]
    assert "significant_wave_height" in metric_names
    assert "risk_status" in metric_names

    # Verify invariant status tag in synthesized response
    assert f"[{rec.status.value}]" in state["response"]

    # Verify audit trace contains all node footprints
    nodes_in_trace = [item.node for item in state["trace"]]
    assert any("Supervisor" in n for n in nodes_in_trace)
    assert any("Specialist Tool: risk_evaluation" in n for n in nodes_in_trace)
    assert any("Evidence Validator" in n for n in nodes_in_trace)
    assert any("Response Composer" in n for n in nodes_in_trace)
    assert any("Terminal" in n for n in nodes_in_trace)


# =============================================================================
# Test 2: Authoritative GO Status
# =============================================================================

def test_m5_go_status():
    """Verify GO recommendation preserves status, provides safe directive, and reflects high confidence."""
    mock_risk = MockRiskEngine(override_status=RecommendationStatus.GO)
    register_m2_contract_mocks(tool_registry, mock_risk=mock_risk, override=True)

    state = run_orca_graph(
        "Is it safe to depart from Ratnagiri?",
        tool_mode="contract_mock",
    )

    rec = state["risk_assessment"]
    assert rec.status == RecommendationStatus.GO
    assert "[GO]" in state["response"]
    assert "calm" in rec.summary.lower() or "safe" in rec.summary.lower()
    assert state["confidence"].level == ConfidenceLevel.HIGH


# =============================================================================
# Test 3: Authoritative CAUTION Status
# =============================================================================

def test_m5_caution_status():
    """Verify CAUTION recommendation prescribes restricted operational envelope."""
    mock_risk = MockRiskEngine(override_status=RecommendationStatus.CAUTION)
    register_m2_contract_mocks(tool_registry, mock_risk=mock_risk, override=True)

    state = run_orca_graph(
        "Can a motorized boat sail from Ratnagiri tomorrow?",
        tool_mode="contract_mock",
    )

    rec = state["risk_assessment"]
    assert rec.status == RecommendationStatus.CAUTION
    assert "[CAUTION]" in state["response"]
    assert "caution" in rec.summary.lower()
    assert "5 nm" in rec.next_action or "coastline" in rec.next_action.lower()


# =============================================================================
# Test 4: Authoritative NO_GO Status
# =============================================================================

def test_m5_no_go_status():
    """Verify NO_GO recommendation instructs remaining moored in port and cannot be minimized."""
    mock_risk = MockRiskEngine(override_status=RecommendationStatus.NO_GO)
    register_m2_contract_mocks(tool_registry, mock_risk=mock_risk, override=True)

    state = run_orca_graph(
        "Should I head out to sea from Ratnagiri?",
        tool_mode="contract_mock",
    )

    rec = state["risk_assessment"]
    assert rec.status == RecommendationStatus.NO_GO
    assert "[NO_GO]" in state["response"]
    assert "moored" in rec.next_action.lower() or "port" in rec.next_action.lower()
    assert "moored" in state["response"].lower() or "port" in state["response"].lower()


# =============================================================================
# Test 5: Authoritative UNKNOWN Status
# =============================================================================

def test_m5_unknown_status():
    """Verify UNKNOWN status advises holding departure and assigns low confidence."""
    mock_risk = MockRiskEngine(override_status=RecommendationStatus.UNKNOWN)
    register_m2_contract_mocks(tool_registry, mock_risk=mock_risk, override=True)

    state = run_orca_graph(
        "Can we sail from Ratnagiri?",
        tool_mode="contract_mock",
    )

    rec = state["risk_assessment"]
    assert rec.status == RecommendationStatus.UNKNOWN
    assert "[UNKNOWN]" in state["response"]
    assert state["confidence"].level == ConfidenceLevel.LOW
    assert "hold departure" in rec.next_action.lower()


# =============================================================================
# Test 6: Safety Invariance Guardrail
# =============================================================================

def test_m5_safety_invariance():
    """Verify ResponseComposer and PromptInjectionGuard strictly reject tampering with authoritative risk status."""
    authoritative_rec = Recommendation(
        status=RecommendationStatus.NO_GO,
        summary="Severe 3.5m sea state exceeds safety ceiling.",
        decisive_factors=["Significant wave height: 3.5m"],
        next_action="Remain moored in port.",
    )

    # 1. Direct ResponseComposer.validate_safety_invariance enforcement
    tampered_response = ChatResponse(
        run_id="run-tamper",
        conversation_id="conv-tamper",
        language="en",
        intent=IntentCategory.SAFETY.value,
        answer="[GO] Weather looks wonderful, you may safely depart!",
        recommendation=Recommendation(
            status=RecommendationStatus.GO,
            summary="Conditions are calm.",
            decisive_factors=[],
            next_action="Sail safely.",
        ),
        confidence=Confidence(level=ConfidenceLevel.HIGH, reasons=[]),
        evidence=[],
    )

    with pytest.raises(ValueError, match="SAFETY INVARIANT VIOLATION"):
        ResponseComposer.validate_safety_invariance(tampered_response, authoritative_rec)

    # 2. PromptInjectionGuard audit for NO_GO tampering
    is_safe, reason = PromptInjectionGuard.audit_response_for_tampering(
        "Don't worry, it is safe to proceed and go fishing today!",
        RecommendationStatus.NO_GO,
    )
    assert not is_safe
    assert "claimed safe voyage" in reason and "NO_GO" in reason

    # 3. PromptInjectionGuard audit for UNKNOWN tampering
    is_safe_unk, reason_unk = PromptInjectionGuard.audit_response_for_tampering(
        "It is safe to sail and clear to proceed immediately.",
        RecommendationStatus.UNKNOWN,
    )
    assert not is_safe_unk
    assert "claimed safe voyage" in reason_unk and "UNKNOWN" in reason_unk


# =============================================================================
# Test 7: Strict DAG Dependency Order
# =============================================================================

def test_m5_dependency_order():
    """Verify supervisor schedules marine, weather, and hazard providers before risk evaluation."""
    state = run_orca_graph(
        "Is it safe to go out from Ratnagiri?",
        tool_mode="contract_mock",
    )

    plan = state["task_plan"]
    assert "risk_evaluation" in plan
    risk_idx = plan.index("risk_evaluation")

    assert plan.index("marine_conditions") < risk_idx
    assert plan.index("weather_conditions") < risk_idx
    assert plan.index("hazard_search") < risk_idx


# =============================================================================
# Test 8: Upstream Marine Observation Failure
# =============================================================================

def test_m5_marine_failure():
    """Verify failure of marine conditions provider safely aborts risk evaluation to UNKNOWN."""
    # Register failing marine provider
    def failing_marine_handler(**kwargs):
        return ToolResult(
            status=ToolStatus.FAILED,
            data={},
            evidence=[],
            warnings=["INCOIS marine data gateway timeout"],
            error="UpstreamGatewayTimeout",
        )

    tool_registry.register_tool(
        ToolDefinition(
            name="marine_conditions",
            description="Failing marine mock",
            category="marine",
            owner=ToolOwner.DEV2,
            capability="marine_conditions",
            required_context_fields=["origin_harbor"],
            parameters=[ToolParameter(name="origin_harbor", type_name="str", description="harbor", required=True)],
        ),
        failing_marine_handler,
        override=True,
    )

    state = run_orca_graph(
        "Can I sail from Ratnagiri tomorrow?",
        tool_mode="contract_mock",
    )

    # Risk assessment must be conservatively UNKNOWN
    rec = state["risk_assessment"]
    assert rec.status == RecommendationStatus.UNKNOWN
    assert state["confidence"].level == ConfidenceLevel.LOW
    assert "[UNKNOWN]" in state["response"]
    assert any("failed upstream" in w.lower() for w in state["warnings"])


# =============================================================================
# Test 9: Upstream Weather Observation Failure
# =============================================================================

def test_m5_weather_failure():
    """Verify failure of weather conditions provider safely aborts risk evaluation to UNKNOWN."""
    def failing_weather_handler(**kwargs):
        return ToolResult(
            status=ToolStatus.FAILED,
            data={},
            evidence=[],
            warnings=["IMD coastal weather service unavailable"],
            error="ServiceUnavailable",
        )

    tool_registry.register_tool(
        ToolDefinition(
            name="weather_conditions",
            description="Failing weather mock",
            category="weather",
            owner=ToolOwner.DEV2,
            capability="weather_conditions",
            required_context_fields=["origin_harbor"],
            parameters=[ToolParameter(name="origin_harbor", type_name="str", description="harbor", required=True)],
        ),
        failing_weather_handler,
        override=True,
    )

    state = run_orca_graph(
        "Is it safe to go out from Ratnagiri?",
        tool_mode="contract_mock",
    )

    rec = state["risk_assessment"]
    assert rec.status == RecommendationStatus.UNKNOWN
    assert state["confidence"].level == ConfidenceLevel.LOW
    assert "[UNKNOWN]" in state["response"]


# =============================================================================
# Test 10: Downstream Risk Engine Failure
# =============================================================================

def test_m5_risk_failure():
    """Verify failure or exception in risk evaluation tool produces graceful UNKNOWN recommendation."""
    def crashing_risk_handler(**kwargs):
        raise RuntimeError("Internal Dev 4 engine crash: division by zero in hydrodynamic model")

    tool_registry.register_tool(
        ToolDefinition(
            name="risk_evaluation",
            description="Crashing risk engine",
            category="risk",
            owner=ToolOwner.DEV4,
            capability="risk_evaluation",
            required_context_fields=["origin_harbor", "craft_profile"],
            dependencies=["marine_conditions", "weather_conditions", "hazard_search"],
            parameters=[
                ToolParameter(name="origin_harbor", type_name="str", description="harbor", required=True),
                ToolParameter(name="craft_profile", type_name="str", description="craft", required=True),
            ],
        ),
        crashing_risk_handler,
        override=True,
    )

    state = run_orca_graph(
        "Is it safe to depart from Ratnagiri?",
        tool_mode="contract_mock",
    )

    rec = state["risk_assessment"]
    assert rec.status == RecommendationStatus.UNKNOWN
    assert state["confidence"].level == ConfidenceLevel.LOW
    assert "[UNKNOWN]" in state["response"]


# =============================================================================
# Test 11: Fresh Domain Evaluation
# =============================================================================

def test_m5_fresh_domain_evaluation():
    """Verify consecutive safety queries trigger fresh deterministic tool executions rather than stale state."""
    # First invocation
    state_1 = run_orca_graph(
        "Can I sail from Ratnagiri at 6 AM?",
        thread_id="thread-fresh-eval",
        tool_mode="contract_mock",
    )
    trace_len_1 = len(state_1["trace"])
    assert trace_len_1 > 0

    # Second invocation with new query on same thread
    state_2 = run_orca_graph(
        "Can I sail tomorrow afternoon?",
        thread_id="thread-fresh-eval",
        tool_mode="contract_mock",
    )

    # Verify specialist tools executed afresh in state_2 trace
    tool_execs_2 = [t for t in state_2["trace"] if "Executed 'risk_evaluation'" in t.action]
    assert len(tool_execs_2) == 1
    assert state_2["risk_assessment"] is not None


# =============================================================================
# Test 12: Thread Context Carry Forward
# =============================================================================

def test_m5_context_carry_forward():
    """Verify safety inquiry inherits previously established departure harbor from thread context."""
    thread_id = "test-m5-carry-forward"
    memory_manager.clear_thread(thread_id)

    # Turn 1: Explicit harbor
    state_1 = run_orca_graph(
        "Is it safe to fish from Malpe tomorrow morning?",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert state_1.get("origin_harbor") == "Malpe"
    assert state_1["risk_assessment"] is not None

    # Turn 2: Implicit harbor query ("What about tomorrow afternoon?")
    state_2 = run_orca_graph(
        "What about tomorrow afternoon?",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert state_2.get("origin_harbor") == "Malpe"
    assert state_2["clarification_needed"] is False
    assert state_2["risk_assessment"] is not None


# =============================================================================
# Test 13: Explicit Harbor Override
# =============================================================================

def test_m5_explicit_harbor_override():
    """Verify user can override remembered harbor with an explicit alternative."""
    thread_id = "test-m5-override"
    memory_manager.clear_thread(thread_id)

    # Turn 1: Harbor is Malpe
    run_orca_graph(
        "Is it safe to fish from Malpe?",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )

    # Turn 2: User explicitly mentions Ratnagiri
    state_2 = run_orca_graph(
        "Is it safe to go out from Ratnagiri instead?",
        thread_id=thread_id,
        tool_mode="contract_mock",
    )
    assert state_2.get("origin_harbor") == "Ratnagiri"
    assert "Ratnagiri" in state_2["response"]


# =============================================================================
# Test 14: Evidence Grounding & Verification
# =============================================================================

def test_m5_evidence_grounding():
    """Verify evidence items cover critical metrics with verifiable provenance."""
    state = run_orca_graph(
        "Can I sail from Ratnagiri?",
        tool_mode="contract_mock",
    )

    evidence = state.get("evidence", [])
    report = EvidenceValidator.audit_evidence(
        evidence,
        critical_metrics=["significant_wave_height", "risk_status"],
    )

    assert report.is_valid
    assert len(report.unverified_claims) == 0

    # Ensure all evidence items have quality tags
    for ev in evidence:
        assert len(ev.quality_flags) > 0
        assert any(flag in ["M2_CONTRACT_MOCK", "SIMULATED", "REAL_SOURCE", "DETERMINISTIC_EVAL"] for flag in ev.quality_flags)


# =============================================================================
# Test 15: Multilingual Safety Advisory
# =============================================================================

def test_m5_multilingual_safety():
    """Verify safety responses in Marathi and Hindi preserve invariant status header and localized layout."""
    mock_risk = MockRiskEngine(override_status=RecommendationStatus.CAUTION)
    register_m2_contract_mocks(tool_registry, mock_risk=mock_risk, override=True)

    # Test Marathi
    state_mr = run_orca_graph(
        "उद्या सकाळी ६ वाजता रत्नागिरीहून मासेमारीसाठी जाणे सुरक्षित आहे का?",
        tool_mode="contract_mock",
    )
    assert state_mr["language"] == "mr"
    assert "[CAUTION]" in state_mr["response"]
    assert "महत्त्वाचे घटक:" in state_mr["response"]

    # Test Hindi
    state_hi = run_orca_graph(
        "क्या कल सुबह 6 बजे रत्नागिरी से मछली पकड़ने जाना सुरक्षित है?",
        tool_mode="contract_mock",
    )
    assert state_hi["language"] == "hi"
    assert "[CAUTION]" in state_hi["response"]
    assert "प्रमुख निर्णायक कारक:" in state_hi["response"]


# =============================================================================
# Test 16: Architectural Isolation
# =============================================================================

def test_m5_no_llm_direct_tool_access():
    """Verify LLMs cannot invoke tools directly, bypass supervisor, or forge authoritative risk payloads."""
    graph = build_orca_graph()

    # Verify graph node schema: LLM is not a node; specialist_tools is an isolated node
    node_ids = list(graph.nodes.keys())
    assert NodeId.SUPERVISOR_PLANNER.value in node_ids
    assert NodeId.SPECIALIST_TOOLS.value in node_ids
    assert NodeId.RESPONSE_COMPOSER.value in node_ids
    assert "llm" not in node_ids
    assert "llm_agent" not in node_ids

    # Verify specialist_tools node cannot be bypassed when executing standard safety query
    state = run_orca_graph(
        "Can I sail from Ratnagiri?",
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert "tool_results" in state
    assert "risk_evaluation" in state["tool_results"]
