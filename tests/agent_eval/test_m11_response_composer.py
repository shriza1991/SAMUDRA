"""Evaluation & Verification Suite for Milestone M11: Response Composer.

Covers all 10 M11 requirements:
1. Recommendation status (GO, CAUTION, NO_GO, UNKNOWN, INFORMATIONAL)
2. Concise summary (1-2 sentences)
3. Decisive factors (Key environmental and risk drivers)
4. Suggested next action (Actionable mariner directive)
5. Confidence explanation (Level & reasons)
6. Evidence references (Verifiable citations with evidence IDs)
7. Warnings (Operational caveats & degraded service alerts)
8. Suggested follow-ups (Contextual quick replies in detected language)
9. Same-language output (English, Marathi, Hindi, Tamil)
10. Concise answer format (Structured, scannable operational template)

Also validates strict invariants:
- Zero risk calculation or override in composer (Dev 4 authoritative)
- Safety invariance enforcement (M5)
- Evidence grounding / Hallucination gate (M10)
- Multilingual language selection (M9)
- Conversational context utilization without fact fabrication (M4/M8)
- 100% offline FakeLLMProvider execution
"""

import pytest

from backend.app.agents.graph import run_orca_graph
from backend.app.agents.intent import LLMResponseDraft
from backend.app.agents.llm import FakeLLMProvider
from backend.app.agents.response import (
    ResponseComposer,
    ResponseCompositionInput,
)
from backend.app.contracts.chat import (
    ChatResponse,
    Confidence,
    ConfidenceLevel,
    EvidenceItem,
    Recommendation,
    RecommendationStatus,
)


def _make_sample_input(
    intent: str = "SAFETY",
    status: RecommendationStatus = RecommendationStatus.CAUTION,
    language: str = "en",
    harbor: str = "Ratnagiri",
    evidence_items=None,
    warnings=None,
) -> ResponseCompositionInput:
    """Helper to construct a standardized ResponseCompositionInput."""
    if evidence_items is None:
        evidence_items = [
            EvidenceItem(
                evidence_id="EV-WAVE-101",
                source_name="INCOIS Ocean State Forecast",
                metric_name="significant_wave_height",
                metric_value=2.2,
                metric_unit="meters",
            ),
            EvidenceItem(
                evidence_id="EV-WIND-202",
                source_name="IMD Coastal Weather",
                metric_name="wind_speed_knots",
                metric_value=22.0,
                metric_unit="knots",
            ),
        ]

    rec = Recommendation(
        status=status,
        summary=f"Elevated wave heights of 2.2m observed near {harbor} warrant caution for small craft.",
        decisive_factors=[
            "Wave height 2.2m exceeds 2.0m threshold for motorized craft [EV-WAVE-101]",
            "Wind speeds sustained at 22.0 knots [EV-WIND-202]",
        ],
        next_action="Stay within 5 nautical miles of coastline and maintain VHF Channel 16 watch.",
    )

    conf = Confidence(
        level=ConfidenceLevel.HIGH,
        reasons=["Direct INCOIS satellite telemetry and IMD station observation"],
    )

    return ResponseCompositionInput(
        run_id="run-m11-test",
        conversation_id="conv-m11-test",
        language=language,
        intent=intent,
        recommendation=rec,
        confidence=conf,
        evidence=evidence_items,
        warnings=warnings or [],
    )


# =============================================================================
# Requirement 1: Recommendation Status
# =============================================================================

def test_req1_recommendation_status_preservation():
    """Verify recommendation status (GO, CAUTION, NO_GO, UNKNOWN, INFORMATIONAL) is preserved and tagged."""
    for st in [
        RecommendationStatus.GO,
        RecommendationStatus.CAUTION,
        RecommendationStatus.NO_GO,
        RecommendationStatus.UNKNOWN,
        RecommendationStatus.INFORMATIONAL,
    ]:
        comp_input = _make_sample_input(status=st)
        formatted_text = ResponseComposer.format_concise_response(comp_input, harbor="Ratnagiri")
        assert f"[{st.value}]" in formatted_text

        chat_resp = ResponseComposer.build_chat_response(
            composition_input=comp_input,
            synthesized_answer=formatted_text,
        )
        assert chat_resp.recommendation.status == st


# =============================================================================
# Requirement 2: Concise Summary
# =============================================================================

def test_req2_concise_summary_presence():
    """Verify recommendation summary is prominently and cleanly included."""
    comp_input = _make_sample_input()
    formatted = ResponseComposer.format_concise_response(comp_input, harbor="Ratnagiri")
    assert comp_input.recommendation.summary in formatted


# =============================================================================
# Requirement 3: Decisive Factors
# =============================================================================

def test_req3_decisive_factors_formatting():
    """Verify decisive factors are bulleted and contain key drivers."""
    comp_input = _make_sample_input()
    formatted = ResponseComposer.format_concise_response(comp_input, harbor="Ratnagiri")
    assert "Key Decisive Factors:" in formatted
    for factor in comp_input.recommendation.decisive_factors:
        assert factor in formatted


# =============================================================================
# Requirement 4: Suggested Next Action
# =============================================================================

def test_req4_suggested_next_action():
    """Verify actionable directive is clearly highlighted for the mariner."""
    comp_input = _make_sample_input()
    formatted = ResponseComposer.format_concise_response(comp_input, harbor="Ratnagiri")
    assert "Actionable Directive:" in formatted
    assert comp_input.recommendation.next_action in formatted


# =============================================================================
# Requirement 5: Confidence Explanation
# =============================================================================

def test_req5_confidence_explanation_multilingual():
    """Verify confidence level and reasons are formatted across languages."""
    conf = Confidence(
        level=ConfidenceLevel.HIGH,
        reasons=["Valid sensor data", "Fresh forecast"],
    )

    en_text = ResponseComposer.format_confidence_explanation(conf, language="en")
    assert "Confidence: High" in en_text
    assert "Valid sensor data" in en_text

    mr_text = ResponseComposer.format_confidence_explanation(conf, language="mr")
    assert "विश्वासार्हता स्तर: उच्च" in mr_text
    assert "Fresh forecast" in mr_text

    hi_text = ResponseComposer.format_confidence_explanation(conf, language="hi")
    assert "विश्वास स्तर: उच्च" in hi_text

    ta_text = ResponseComposer.format_confidence_explanation(conf, language="ta")
    assert "நம்பகத்தன்மை: உயர்" in ta_text


# =============================================================================
# Requirement 6: Evidence References
# =============================================================================

def test_req6_evidence_references_attached_and_cited():
    """Verify evidence items are retained in ChatResponse and listed in answer."""
    comp_input = _make_sample_input()
    formatted = ResponseComposer.format_concise_response(comp_input, harbor="Ratnagiri")
    assert "Supporting Evidence:" in formatted
    assert "INCOIS Ocean State Forecast" in formatted
    assert "IMD Coastal Weather" in formatted

    chat_resp = ResponseComposer.build_chat_response(comp_input, synthesized_answer=formatted)
    assert len(chat_resp.evidence) == 2
    assert chat_resp.evidence[0].evidence_id == "EV-WAVE-101"
    assert chat_resp.evidence[1].evidence_id == "EV-WIND-202"


# =============================================================================
# Requirement 7: Warnings
# =============================================================================

def test_req7_operational_warnings_included():
    """Verify operational warnings are surfaced when present."""
    warnings = ["Upstream tide gauge sensor degraded", "Observation timestamp older than 3 hours"]
    comp_input = _make_sample_input(warnings=warnings)
    formatted = ResponseComposer.format_concise_response(comp_input, harbor="Ratnagiri")

    assert "Operational Warnings:" in formatted
    assert "Upstream tide gauge sensor degraded" in formatted
    assert "Observation timestamp older than 3 hours" in formatted

    chat_resp = ResponseComposer.build_chat_response(comp_input, synthesized_answer=formatted)
    assert chat_resp.warnings == warnings


# =============================================================================
# Requirement 8: Suggested Follow-ups
# =============================================================================

def test_req8_suggested_followups_contextual_generation():
    """Verify contextual quick-reply followups are generated based on intent, status, and language."""
    # Safety NO_GO in English
    fu_en_nogo = ResponseComposer.generate_suggested_followups(
        intent="SAFETY",
        status=RecommendationStatus.NO_GO,
        language="en",
    )
    assert len(fu_en_nogo) >= 2
    assert any("conditions improve" in q.lower() or "alternative" in q.lower() for q in fu_en_nogo)

    # PFZ in Marathi
    fu_mr_pfz = ResponseComposer.generate_suggested_followups(
        intent="PFZ",
        status=RecommendationStatus.GO,
        language="mr",
    )
    assert len(fu_mr_pfz) >= 2
    assert any("PFZ" in q for q in fu_mr_pfz)

    # ROUTE in Hindi
    fu_hi_route = ResponseComposer.generate_suggested_followups(
        intent="ROUTE",
        status=RecommendationStatus.CAUTION,
        language="hi",
    )
    assert len(fu_hi_route) >= 2

    # Hazards in English
    fu_en_haz = ResponseComposer.generate_suggested_followups(
        intent="HAZARDS",
        status=RecommendationStatus.CAUTION,
        language="en",
    )
    assert any("cyclone" in q.lower() or "geofence" in q.lower() for q in fu_en_haz)


# =============================================================================
# Requirement 9: Same-Language Output
# =============================================================================

def test_req9_same_language_output_formatting():
    """Verify full responses in Marathi, Hindi, and English maintain language consistency."""
    # Marathi
    mr_input = _make_sample_input(language="mr")
    mr_resp = ResponseComposer.format_concise_response(mr_input, harbor="रत्नागिरी")
    assert "सागरी सुरक्षा सल्ला" in mr_resp
    assert "महत्त्वाचे घटक:" in mr_resp
    assert "कृती निर्देश:" in mr_resp
    assert "पुरावा आधार:" in mr_resp

    # Hindi
    hi_input = _make_sample_input(language="hi")
    hi_resp = ResponseComposer.format_concise_response(hi_input, harbor="रत्नागिरी")
    assert "समुद्री सुरक्षा सलाह" in hi_resp
    assert "प्रमुख निर्णायक कारक:" in hi_resp
    assert "कार्रवाई निर्देश:" in hi_resp
    assert "साक्ष्य आधार:" in hi_resp

    # Tamil
    ta_input = _make_sample_input(language="ta")
    ta_resp = ResponseComposer.format_concise_response(ta_input, harbor="தூத்துக்குடி")
    assert "கடல்சார் பாதுகாப்பு ஆலோசனை" in ta_resp
    assert "முக்கிய காரணிகள்:" in ta_resp
    assert "செயல்முறை வழிகாட்டுதல்:" in ta_resp


# =============================================================================
# Requirement 10: Concise Answer Format
# =============================================================================

def test_req10_concise_answer_format_structure():
    """Verify output is structured, scannable, and free of redundant preamble."""
    comp_input = _make_sample_input()
    formatted = ResponseComposer.format_concise_response(comp_input, harbor="Ratnagiri")

    lines = [line.strip() for line in formatted.split("\n") if line.strip()]
    assert lines[0].startswith("[CAUTION]")
    assert any("Key Decisive Factors:" in line_str for line_str in lines)
    assert any("Actionable Directive:" in line_str for line_str in lines)
    assert any("Confidence:" in line_str for line_str in lines)
    assert any("Supporting Evidence:" in line_str for line_str in lines)


# =============================================================================
# Invariant: Safety Invariance Enforcement (M5)
# =============================================================================

def test_safety_invariance_guard_catches_tampering():
    """Verify ResponseComposer rejects any attempt to override or soften status."""
    original_rec = Recommendation(
        status=RecommendationStatus.NO_GO,
        summary="Extreme wave conditions 4.0m.",
        decisive_factors=["4.0m wave height"],
        next_action="Remain in harbor.",
    )

    tampered_rec = Recommendation(
        status=RecommendationStatus.GO,  # Softened
        summary="Safe to depart.",
        decisive_factors=[],
        next_action="Go ahead.",
    )

    tampered_response = ChatResponse(
        run_id="r1",
        conversation_id="c1",
        language="en",
        intent="SAFETY",
        answer="Conditions are safe to depart.",
        recommendation=tampered_rec,
        confidence=Confidence(level=ConfidenceLevel.HIGH),
        evidence=[],
    )

    with pytest.raises(ValueError, match="SAFETY INVARIANT VIOLATION"):
        ResponseComposer.validate_safety_invariance(tampered_response, original_rec)


# =============================================================================
# Invariant: Evidence Validation & Hallucination Gate (M10 Integration)
# =============================================================================

def test_hallucination_gate_suppresses_unsupported_facts():
    """Verify LLM draft with unsupported numerical claims is sanitized before response composition."""
    fake_llm = FakeLLMProvider()
    fake_llm.set_canned_structured_response(
        LLMResponseDraft(
            synthesized_text="Wave height is 1.8 m [EV-WAVE-1], and wind speed is 55 km/h.",
            used_evidence_ids=["EV-WAVE-1"],
            confidence_score=0.9,
        )
    )

    # Execute graph with FakeLLM
    result = run_orca_graph(
        user_message="Is it safe to sail from Ratnagiri?",
        tool_mode="demo",
        llm_provider=fake_llm,
        llm_mode="fake",
    )

    # 55 km/h was hallucinated (not in evidence) -> must be suppressed or fallback triggered
    final_answer = result["response"]
    assert "55 km/h" not in final_answer


# =============================================================================
# Invariant: End-to-End Multilingual Graph Integration (M9 Integration)
# =============================================================================

def test_e2e_graph_response_composition_marathi():
    """Verify end-to-end LangGraph pipeline produces complete M11 response in Marathi."""
    result = run_orca_graph(
        user_message="उद्या सकाळी रत्नागिरीहून मासेमारीला जाणे सुरक्षित आहे का?",
        tool_mode="demo",
        llm_mode="deterministic",
    )

    assert result["language"] == "mr"
    assert result["response"] is not None
    assert "[CAUTION]" in result["response"] or "[GO]" in result["response"] or "[NO_GO]" in result["response"]
    assert "सागरी सुरक्षा सल्ला" in result["response"]
    assert result["suggested_followups"] is not None
    assert len(result["suggested_followups"]) >= 2


def test_e2e_graph_response_composition_hindi():
    """Verify end-to-end LangGraph pipeline produces complete M11 response in Hindi."""
    result = run_orca_graph(
        user_message="क्या कल सुबह रत्नागिरी से मछली पकड़ने जाना सुरक्षित है?",
        tool_mode="demo",
        llm_mode="deterministic",
    )

    assert result["language"] == "hi"
    assert result["response"] is not None
    assert "समुद्री सुरक्षा सलाह" in result["response"]
    assert result["suggested_followups"] is not None
    assert len(result["suggested_followups"]) >= 2


def test_e2e_graph_response_composition_english():
    """Verify end-to-end LangGraph pipeline produces complete M11 response in English."""
    result = run_orca_graph(
        user_message="Is it safe to go fishing from Ratnagiri tomorrow morning?",
        tool_mode="demo",
        llm_mode="deterministic",
    )

    assert result["language"] == "en"
    assert result["response"] is not None
    assert result["suggested_followups"] is not None
    assert len(result["suggested_followups"]) >= 2
    assert result["risk_assessment"] is not None
    assert result["confidence"] is not None


# =============================================================================
# Invariant: Conversational Context Without Fact Fabrication (M4/M8 Integration)
# =============================================================================

def test_multi_turn_response_composition_preserves_context():
    """Verify multi-turn memory retains harbor across turns without inventing facts."""
    thread_id = "test-m11-multiturn"

    # Turn 1: Establish harbor
    t1 = run_orca_graph(
        user_message="Is it safe from Malvan tomorrow morning?",
        thread_id=thread_id,
        tool_mode="demo",
        llm_mode="deterministic",
    )
    assert "Malvan" in (t1["origin_harbor"] or "")

    # Turn 2: Follow up without repeating harbor
    t2 = run_orca_graph(
        user_message="What about the afternoon?",
        thread_id=thread_id,
        tool_mode="demo",
        llm_mode="deterministic",
    )
    assert t2["origin_harbor"] == "Malvan"
    assert t2["response"] is not None
    assert t2["risk_assessment"] is not None
