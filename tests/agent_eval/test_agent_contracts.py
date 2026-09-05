"""Contract and Behavioral Tests for Dev 3 (Agent Orchestration & Explainability).

Validates:
1. ORCAState TypedDict structure and AgentState backward compatibility alias.
2. IntentCategory taxonomy and normalization.
3. AgentToolRegistry typed registration and execution boundary enforcement.
4. MemoryManager context carry-forward and selective update rules.
5. AgentTraceLogger sanitization preventing chain-of-thought leakage.
6. ResponseComposer safety invariance (detecting recommendation tampering).
7. EvidenceValidator audit assertions.
8. AgentEvalCase benchmark fixtures validity.
"""

import pytest
from pydantic import ValidationError

from backend.app.agents.evidence import EvidenceRecord, EvidenceValidator
from backend.app.agents.graph import GRAPH_NODE_REGISTRY, NodeId, RoutingPolicy
from backend.app.agents.intent import (
    ExtractedEntities,
    IntentCategory,
    normalize_intent,
)
from backend.app.agents.memory import MemoryManager, ThreadContext
from backend.app.agents.response import ResponseComposer, ResponseCompositionInput
from backend.app.agents.state import AgentState, ORCAState
from backend.app.agents.supervisor import get_default_plan_for_intent
from backend.app.agents.tools import (
    AgentToolRegistry,
    ToolDefinition,
    ToolParameter,
    ToolStatus,
)
from backend.app.agents.trace import AgentTraceLogger, TraceStatus
from backend.app.contracts.chat import (
    Confidence,
    ConfidenceLevel,
    EvidenceItem,
    Recommendation,
    RecommendationStatus,
)
from backend.app.contracts.tools import ToolResult
from tests.agent_eval.fixtures import BENCHMARK_EVAL_CASES


def test_orca_state_typing_and_alias():
    """Verify ORCAState keys and AgentState alias."""
    assert AgentState is ORCAState

    sample_state: ORCAState = {
        "request_id": "req-001",
        "thread_id": "th-001",
        "user_message": "Is it safe from Ratnagiri?",
        "language": "en",
        "intent": IntentCategory.SAFETY.value,
        "missing_fields": [],
        "task_plan": ["marine_weather_forecast", "evaluate_safety_risk"],
        "evidence": [],
        "warnings": [],
        "trace": [],
    }
    assert sample_state["request_id"] == "req-001"
    assert sample_state["intent"] == "SAFETY"


def test_intent_category_and_normalization():
    """Test controlled intent taxonomy and legacy alias normalization."""
    assert IntentCategory.PFZ.value == "PFZ"
    assert IntentCategory.SAFETY.value == "SAFETY"
    assert IntentCategory.CONDITIONS.value == "CONDITIONS"
    assert IntentCategory.HAZARDS.value == "HAZARDS"
    assert IntentCategory.ROUTE.value == "ROUTE"
    assert IntentCategory.ANALYTICAL_EXPLANATION.value == "ANALYTICAL_EXPLANATION"
    assert IntentCategory.UNSUPPORTED.value == "UNSUPPORTED"

    # Test alias mappings
    assert normalize_intent("NEAREST_PFZ") == IntentCategory.PFZ
    assert normalize_intent("GO_NO_GO_SAFETY") == IntentCategory.SAFETY
    assert normalize_intent("HAZARD_BOUNDARY") == IntentCategory.HAZARDS
    assert normalize_intent("SAFER_ROUTE") == IntentCategory.ROUTE
    assert normalize_intent("random query") == IntentCategory.UNSUPPORTED


def test_supervisor_standard_plans():
    """Ensure supervisor plans for intents include safety evaluation where required."""
    safety_plan = get_default_plan_for_intent(IntentCategory.SAFETY)
    assert "evaluate_safety_risk" in safety_plan

    pfz_plan = get_default_plan_for_intent(IntentCategory.PFZ)
    assert "fetch_pfz_advisories" in pfz_plan
    assert "evaluate_safety_risk" in pfz_plan


def test_tool_registry_boundary_enforcement():
    """Verify tool registry enforces whitelisting and records telemetry."""
    registry = AgentToolRegistry()

    # Attempt to execute an unregistered tool
    result = registry.execute_tool("arbitrary_bash_command", {"cmd": "rm -rf /"})
    assert result.status == ToolStatus.FAILED
    assert result.error_code == "TOOL_NOT_REGISTERED"
    assert "not in approved registry" in result.warnings[0]

    # Register an approved tool
    def mock_weather_tool(harbor: str) -> ToolResult:
        return ToolResult(
            status=ToolStatus.OK,
            data={"wave_height_m": 1.1, "wind_kts": 12.0},
            evidence=[
                EvidenceItem(
                    source_name="INCOIS",
                    metric_name="significant_wave_height",
                    metric_value=1.1,
                    metric_unit="meters",
                )
            ],
            warnings=[],
        )

    tool_def = ToolDefinition(
        name="marine_weather_forecast",
        description="Fetch wave height and wind for a harbor",
        category="marine",
        parameters=[
            ToolParameter(name="harbor", type_name="str", description="Harbor name", required=True)
        ],
    )
    registry.register_tool(tool_def, mock_weather_tool)

    # Execute approved tool
    exec_res = registry.execute_tool("marine_weather_forecast", {"harbor": "Ratnagiri"})
    assert exec_res.status == ToolStatus.OK
    assert exec_res.data["wave_height_m"] == 1.1

    # Verify execution history telemetry
    history = registry.execution_history
    assert len(history) == 2
    approved_rec = history[1]
    assert approved_rec.tool_name == "marine_weather_forecast"
    assert approved_rec.duration_ms >= 0.0
    assert "significant_wave_height" in approved_rec.evidence_ids


def test_memory_context_carry_forward():
    """Verify selective context carry-forward across multi-turn queries."""
    memory = MemoryManager()
    thread_id = "test-thread-42"

    # Turn 1: User specifies harbor and craft
    t1_entities = ExtractedEntities(
        origin_harbor="Ratnagiri",
        craft_type="motorized_boat",
        departure_time="tomorrow morning",
    )
    ctx1 = memory.update_context(
        thread_id=thread_id,
        entities=t1_entities,
        intent=IntentCategory.SAFETY,
        language="mr",
    )
    assert ctx1.active_harbor == "Ratnagiri"
    assert ctx1.active_craft_profile == "motorized_boat"
    assert ctx1.turn_count == 1

    # Turn 2: User only changes departure time: "What about afternoon?"
    t2_entities = ExtractedEntities(departure_time="tomorrow afternoon")
    ctx2 = memory.update_context(
        thread_id=thread_id,
        entities=t2_entities,
        intent=IntentCategory.SAFETY,
    )
    # Harbor and craft MUST be retained!
    assert ctx2.active_harbor == "Ratnagiri"
    assert ctx2.active_craft_profile == "motorized_boat"
    assert ctx2.preferred_language == "mr"
    assert ctx2.turn_count == 2

    # Verify missing fields resolution
    unresolved = memory.resolve_missing_fields(
        thread_id=thread_id,
        entities=ExtractedEntities(),  # Empty entities in new turn
        required_fields=["origin_harbor", "craft_profile", "departure_time"],
    )
    # Origin and craft resolved from memory; departure_time is missing from current turn
    assert "origin_harbor" not in unresolved
    assert "craft_profile" not in unresolved
    assert "departure_time" in unresolved


def test_trace_sanitization_no_cot_leakage():
    """Verify AgentTraceLogger strips chain-of-thought and sensitive patterns."""
    logger = AgentTraceLogger()

    # Safe milestone event
    logger.record_event(
        agent="Supervisor",
        action="Planned 3 specialist tools for execution",
        status=TraceStatus.COMPLETED,
    )

    # Event containing chain-of-thought markers
    unsafe_action = "Thought: I should check weather first. <think>Secret internal reasoning</think> Done."
    ev = logger.record_event(
        agent="ResponseComposer",
        action=unsafe_action,
        status=TraceStatus.COMPLETED,
    )

    # Chain-of-thought tokens must be redacted
    assert "<think>" not in ev.action
    assert "[REDACTED_INTERNAL]" in ev.action

    # Convert to contract format
    contract_trace = logger.to_contract_trace()
    assert len(contract_trace) == 2
    assert contract_trace[0].node == "Supervisor"


def test_response_composer_safety_invariance():
    """Verify that tampering with deterministic RecommendationStatus raises an invariant error."""
    original_rec = Recommendation(
        status=RecommendationStatus.NO_GO,
        summary="Waves 3.8m exceed safety limits.",
        decisive_factors=["3.8m waves", "IMD squall warning"],
        next_action="Do not depart port.",
    )

    comp_input = ResponseCompositionInput(
        run_id="run-1",
        conversation_id="conv-1",
        language="en",
        intent="SAFETY",
        recommendation=original_rec,
        confidence=Confidence(level=ConfidenceLevel.HIGH, reasons=["Official data"]),
        evidence=[],
    )

    # Building response preserving NO_GO should succeed
    valid_resp = ResponseComposer.build_chat_response(
        composition_input=comp_input,
        synthesized_answer="Conditions are unsafe. Please do not depart.",
    )
    assert valid_resp.recommendation.status == RecommendationStatus.NO_GO

    # Tampering with status must trigger safety invariant error
    tampered_rec = Recommendation(
        status=RecommendationStatus.GO,  # Softened!
        summary="Tampered summary",
        decisive_factors=[],
        next_action="Go ahead",
    )
    tampered_resp = valid_resp.model_copy(update={"recommendation": tampered_rec})

    with pytest.raises(ValueError, match="SAFETY INVARIANT VIOLATION"):
        ResponseComposer.validate_safety_invariance(tampered_resp, original_rec)


def test_evidence_validator_audit():
    """Verify EvidenceValidator detects missing or unverified claims."""
    evidence = [
        EvidenceItem(
            source_name="INCOIS",
            metric_name="significant_wave_height",
            metric_value=1.5,
            metric_unit="meters",
        )
    ]

    report = EvidenceValidator.audit_evidence(
        evidence_items=evidence,
        critical_metrics=["significant_wave_height", "wind_speed_knots"],
    )
    assert report.is_valid is False
    assert "wind_speed_knots" in report.unverified_claims
    assert report.verified_evidence_count == 1


def test_eval_benchmark_fixtures_validity():
    """Ensure all 9 benchmark evaluation fixtures conform strictly to AgentEvalCase schema."""
    assert len(BENCHMARK_EVAL_CASES) >= 9

    for case in BENCHMARK_EVAL_CASES:
        assert case.case_id.startswith("EVAL-")
        assert case.query != ""
        assert case.expected_intent in IntentCategory
        assert case.expected_safety_behavior in RecommendationStatus
        assert isinstance(case.expected_tools, list)
