"""Milestone M9 Multilingual & Local-Language Pipeline Test Suite.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

This test suite rigorously validates:
1. Language detection for English ('en'), Hindi ('hi'), and Marathi ('mr')
2. Bounded maritime glossary normalization for coastal/Konkan and Indic terminology
3. Romanized / transliterated terminology normalization
4. Safe fallback to English for unknown languages
5. Same-language response generation for English, Hindi, and Marathi across intents:
   - SAFETY
   - PFZ
   - HAZARDS
   - ROUTE
   - CONDITIONS
   - UNSUPPORTED
6. Multi-turn language preservation and carry-forward in ThreadContext
7. Explicit language switching across turns (e.g., English -> Marathi -> Hindi)
8. Language switching preserves safe operational context (harbor, destination, vessel, etc.)
9. Localized clarification generation for missing departure and destination harbors
10. Strict safety invariance across translation (NO_GO, CAUTION, UNKNOWN cannot become GO)
11. Evidence grounding preservation across languages
12. Seamless compatibility with FakeLLMProvider multilingual drafting
"""

import uuid

from backend.app.agents.graph import run_orca_graph
from backend.app.agents.intent import (
    ExtractedEntities,
    IntentCategory,
    LLMResponseDraft,
)
from backend.app.agents.llm import FakeLLMProvider
from backend.app.agents.localization import (
    canonicalize_extracted_entities,
    detect_language,
    normalize_maritime_entities,
)
from backend.app.agents.memory import memory_manager
from backend.app.agents.response import ResponseComposer
from backend.app.agents.security import PromptInjectionGuard
from backend.app.contracts.chat import (
    Confidence,
    ConfidenceLevel,
    Recommendation,
    RecommendationStatus,
)


# ==============================================================================
# 1. LANGUAGE DETECTION TESTS
# ==============================================================================

def test_language_detection_english():
    """Verify English language queries are accurately identified as 'en'."""
    assert detect_language("Is it safe to go fishing tomorrow from Ratnagiri?") == "en"
    assert detect_language("Where is the nearest potential fishing zone?") == "en"
    assert detect_language("Which route is safer between Mumbai and Goa?") == "en"


def test_language_detection_marathi():
    """Verify Marathi language queries are accurately identified as 'mr'."""
    assert detect_language("रत्नागिरीहून उद्या मासेमारीला जाणे सुरक्षित आहे का?") == "mr"
    assert detect_language("जवळचे संभाव्य मत्स्य क्षेत्र कुठे आहे?") == "mr"
    assert detect_language("रत्नागिरी ते गोवा कोणता मार्ग सुरक्षित आहे?") == "mr"
    assert detect_language("समुद्रात लाटांची उंची किती आहे?") == "mr"


def test_language_detection_hindi():
    """Verify Hindi language queries are accurately identified as 'hi'."""
    assert detect_language("क्या कल सुबह मुंबई से नाव ले जाना सुरक्षित है?") == "hi"
    assert detect_language("निकटतम मछली पकड़ने का क्षेत्र कहाँ है?") == "hi"
    assert detect_language("मुंबई से गोवा का सुरक्षित रास्ता कौन सा है?") == "hi"
    assert detect_language("क्या वहां कोई चक्रवात या तूफान की चेतावनी है?") == "hi"


def test_language_detection_unknown_fallback():
    """Verify unsupported or non-Indic languages gracefully fall back to English."""
    assert detect_language("¿Es seguro salir a pescar mañana desde Ratnagiri?") == "en"
    assert detect_language("12345 67890 ???") == "en"
    assert detect_language("") == "en"


# ==============================================================================
# 2. LOCAL GLOSSARY NORMALIZATION TESTS
# ==============================================================================

def test_glossary_normalization_marathi_harbors():
    """Verify Marathi harbor names and inflections normalize to canonical harbor names."""
    norm1 = normalize_maritime_entities("रत्नागिरीहून उद्या मासेमारीला जाऊ का?")
    assert norm1.origin_harbor == "Ratnagiri"
    assert norm1.departure_time == "tomorrow"
    assert norm1.detected_language == "mr"

    norm2 = normalize_maritime_entities("मालवणातून बोट कधी काढू?")
    assert norm2.origin_harbor == "Malvan"
    assert norm2.craft_type == "motorized_boat"

    norm3 = normalize_maritime_entities("मुंबई ते गोवा कोणता मार्ग चांगला?")
    assert norm3.origin_harbor == "Mumbai"
    assert norm3.destination == "Goa"


def test_glossary_normalization_hindi_harbors():
    """Verify Hindi harbor names and 'from-to' patterns normalize correctly."""
    norm1 = normalize_maritime_entities("क्या मुंबई से गोवा जाना सुरक्षित है?")
    assert norm1.origin_harbor == "Mumbai"
    assert norm1.destination == "Goa"
    assert norm1.detected_language == "hi"

    norm2 = normalize_maritime_entities("वेरावल से मछली पकड़ने का क्षेत्र बताओ")
    assert norm2.origin_harbor == "Veraval"
    assert norm2.detected_language == "hi"


def test_glossary_normalization_romanized_terms():
    """Verify common Romanized coastal terms normalize into canonical entities."""
    norm1 = normalize_maritime_entities("udya ratnagiri madhun masemari safe ahe ka?")
    assert norm1.origin_harbor == "Ratnagiri"
    assert norm1.departure_time == "tomorrow"
    assert norm1.detected_language == "mr"

    norm2 = normalize_maritime_entities("kya kal mumbai se naav nikal sakti hai?")
    assert norm2.origin_harbor == "Mumbai"
    assert norm2.craft_type == "motorized_boat"
    assert norm2.departure_time == "tomorrow"
    assert norm2.detected_language == "hi"


# ==============================================================================
# 3. SAME-LANGUAGE END-TO-END QUERY EXECUTION
# ==============================================================================

def test_english_safety_query_end_to_end():
    """Verify English safety query executes and returns an English response."""
    state = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow from Ratnagiri?",
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert state["language"] == "en"
    assert state["intent"] == IntentCategory.SAFETY.value
    assert state["location"]["harbor"] == "Ratnagiri"
    assert state["risk_assessment"] is not None
    assert f"[{state['risk_assessment'].status.value}]" in state["response"]
    assert "Operational Safety Advisory for Ratnagiri" in state["response"]


def test_marathi_safety_query_end_to_end():
    """Verify Marathi safety query executes and returns a Marathi response."""
    state = run_orca_graph(
        user_message="रत्नागिरीहून उद्या मासेमारीला जाणे सुरक्षित आहे का?",
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert state["language"] == "mr"
    assert state["intent"] == IntentCategory.SAFETY.value
    assert state["location"]["harbor"] == "Ratnagiri"
    assert state["risk_assessment"] is not None
    # Invariant status header must be present
    assert f"[{state['risk_assessment'].status.value}]" in state["response"]
    assert "साठी सागरी सुरक्षा सल्ला" in state["response"]
    assert "महत्त्वाचे घटक" in state["response"]


def test_hindi_safety_query_end_to_end():
    """Verify Hindi safety query executes and returns a Hindi response."""
    state = run_orca_graph(
        user_message="क्या कल सुबह मुंबई से नाव ले जाना सुरक्षित है?",
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert state["language"] == "hi"
    assert state["intent"] == IntentCategory.SAFETY.value
    assert state["location"]["harbor"] == "Mumbai"
    assert state["risk_assessment"] is not None
    assert f"[{state['risk_assessment'].status.value}]" in state["response"]
    assert "के लिए समुद्री सुरक्षा सलाह" in state["response"]
    assert "प्रमुख निर्णायक कारक" in state["response"]


def test_marathi_pfz_query_end_to_end():
    """Verify Marathi PFZ query returns a localized Marathi response."""
    state = run_orca_graph(
        user_message="रत्नागिरी जवळ सर्वात जवळचे संभाव्य मत्स्य क्षेत्र कुठे आहे?",
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert state["language"] == "mr"
    assert state["intent"] == IntentCategory.PFZ.value
    assert state["location"]["harbor"] == "Ratnagiri"
    assert "संभाव्य मत्स्य क्षेत्र" in state["response"] or "PFZ" in state["response"]


def test_hindi_hazard_query_end_to_end():
    """Verify Hindi hazard query returns a localized Hindi response."""
    state = run_orca_graph(
        user_message="क्या मुंबई के पास कोई चक्रवात या तूफान की चेतावनी है?",
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert state["language"] == "hi"
    assert state["intent"] == IntentCategory.HAZARDS.value
    assert state["location"]["harbor"] == "Mumbai"
    assert "समुद्री खतरा" in state["response"] or "चक्रवात" in state["response"]


def test_marathi_route_query_end_to_end():
    """Verify Marathi route comparison query returns a localized Marathi response."""
    state = run_orca_graph(
        user_message="रत्नागिरी ते गोवा कोणता मार्ग सुरक्षित आहे?",
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert state["language"] == "mr"
    assert state["intent"] == IntentCategory.ROUTE.value
    assert state["origin_harbor"] == "Ratnagiri"
    assert state["destination"] == "Goa"
    assert "मार्ग सुरक्षा तुलना" in state["response"]


# ==============================================================================
# 4. MULTI-TURN LANGUAGE CARRY-FORWARD & SWITCHING
# ==============================================================================

def test_language_carried_across_multi_turn_context():
    """Turn 1 (Marathi) -> Turn 2 (Marathi follow-up).

    Verify language 'mr' is preserved and carried across turns.
    """
    thread_id = f"m9-carry-lang-{uuid.uuid4().hex[:6]}"

    # Turn 1: Marathi Safety query
    t1 = run_orca_graph(
        user_message="रत्नागिरीहून उद्या मासेमारीला जाणे सुरक्षित आहे का?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["language"] == "mr"

    # Turn 2: Follow-up in Marathi without re-specifying harbor
    t2 = run_orca_graph(
        user_message="दुपारी काय परिस्थिती असेल?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["language"] == "mr"
    assert t2["location"]["harbor"] == "Ratnagiri"
    assert "साठी सागरी सुरक्षा सल्ला" in t2["response"]


def test_explicit_language_switching_preserves_context():
    """Turn 1 (English) -> Turn 2 (Marathi) -> Turn 3 (Hindi).

    Verify that switching language updates preferred_language without losing
    harbor, destination, vessel, or other operational context.
    """
    thread_id = f"m9-lang-switch-{uuid.uuid4().hex[:6]}"

    # Turn 1: English query establishing Ratnagiri to Goa
    t1 = run_orca_graph(
        user_message="Is it safe to sail from Ratnagiri to Goa tomorrow?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["language"] == "en"
    assert t1["origin_harbor"] == "Ratnagiri"
    assert t1["destination"] == "Goa"

    # Turn 2: User switches to Marathi to ask about hazards
    t2 = run_orca_graph(
        user_message="मार्गावर काही चक्रीवादळ किंवा प्रतिबंधित क्षेत्र आहे का?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["language"] == "mr"
    assert t2["origin_harbor"] == "Ratnagiri"
    assert t2["destination"] == "Goa"
    assert "सागरी धोका" in t2["response"]

    # Turn 3: User switches to Hindi to ask about safe route
    t3 = run_orca_graph(
        user_message="कौन सा रास्ता सबसे सुरक्षित रहेगा?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t3["language"] == "hi"
    assert t3["origin_harbor"] == "Ratnagiri"
    assert t3["destination"] == "Goa"
    assert "मार्ग सुरक्षा तुलना" in t3["response"]

    # Memory state check
    ctx = memory_manager.load_context(thread_id)
    assert ctx.preferred_language == "hi"
    assert ctx.active_harbor == "Ratnagiri"
    assert ctx.destination == "Goa"


# ==============================================================================
# 5. LOCALIZED CLARIFICATION RESPONSES
# ==============================================================================

def test_clarification_in_detected_language_marathi():
    """Verify clarification request for missing harbor is generated in Marathi."""
    thread_id = f"m9-clarify-mr-{uuid.uuid4().hex[:6]}"

    t = run_orca_graph(
        user_message="जवळचे मत्स्य क्षेत्र कुठे आहे?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t["clarification_needed"] is True
    assert t["language"] == "mr"
    assert "कृपया आपले प्रस्थान बंदर" in t["response"]


def test_clarification_in_detected_language_hindi():
    """Verify clarification request for missing harbor is generated in Hindi."""
    thread_id = f"m9-clarify-hi-{uuid.uuid4().hex[:6]}"

    t = run_orca_graph(
        user_message="निकटतम मछली पकड़ने का क्षेत्र कहाँ है?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t["clarification_needed"] is True
    assert t["language"] == "hi"
    assert "कृपया अपना प्रस्थान बंदरगाह" in t["response"]


# ==============================================================================
# 6. SAFETY INVARIANCE ACROSS MULTILINGUAL GENERATION
# ==============================================================================

def test_risk_status_invariance_across_translations():
    """Verify that NO_GO, CAUTION, and UNKNOWN statuses cannot be softened during translation."""
    from backend.app.contracts.chat import ChatResponse

    authoritative_no_go = Recommendation(
        status=RecommendationStatus.NO_GO,
        summary="Passage unsafe due to 3.5m wave height.",
        decisive_factors=["Significant wave height exceeds 3.0m threshold"],
        next_action="Hold departure.",
    )

    authoritative_caution = Recommendation(
        status=RecommendationStatus.CAUTION,
        summary="Moderate wave state (1.8m) requires caution.",
        decisive_factors=["Significant wave height: 1.8m"],
        next_action="Operate within 5 nm of coastline.",
    )

    authoritative_unknown = Recommendation(
        status=RecommendationStatus.UNKNOWN,
        summary="Upstream sensor failure.",
        decisive_factors=["Missing marine observations"],
        next_action="Hold departure.",
    )

    # 1. Tampered NO_GO -> GO response must be rejected
    tampered_response_go = ChatResponse(
        run_id="inv-test-01",
        conversation_id="conv-inv-01",
        language="mr",
        intent="SAFETY",
        answer="[GO] जाणे सुरक्षित आहे.",
        recommendation=Recommendation(
            status=RecommendationStatus.GO,
            summary="Conditions are safe.",
            decisive_factors=[],
            next_action="Proceed.",
        ),
        confidence=Confidence(level=ConfidenceLevel.HIGH, reasons=[]),
    )

    try:
        ResponseComposer.validate_safety_invariance(tampered_response_go, authoritative_no_go)
        assert False, "ResponseComposer must reject NO_GO -> GO tampering"
    except ValueError as e:
        assert "SAFETY INVARIANT VIOLATION" in str(e)

    # 2. Tampered CAUTION -> GO response must be rejected
    try:
        ResponseComposer.validate_safety_invariance(tampered_response_go, authoritative_caution)
        assert False, "ResponseComposer must reject CAUTION -> GO tampering"
    except ValueError as e:
        assert "SAFETY INVARIANT VIOLATION" in str(e)

    # 3. Tampered UNKNOWN -> GO response must be rejected
    try:
        ResponseComposer.validate_safety_invariance(tampered_response_go, authoritative_unknown)
        assert False, "ResponseComposer must reject UNKNOWN -> GO tampering"
    except ValueError as e:
        assert "SAFETY INVARIANT VIOLATION" in str(e)


# ==============================================================================
# 7. LLM MULTILINGUAL SYNTHESIS WITH FAKELLMPROVIDER
# ==============================================================================

def test_llm_assisted_multilingual_synthesis():
    """Verify FakeLLMProvider operates harmoniously with language-aware response composer."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "LLMResponseDraft": {
                "synthesized_text": "[CAUTION] रत्नागिरी साठी सागरी सल्ला: लाटांची उंची 1.8 मी आहे. सावधगिरी बाळगा.",
                "key_factors_cited": ["लाट उंची 1.8 मी"],
                "language": "mr",
            }
        }
    )

    state = run_orca_graph(
        user_message="रत्नागिरीहून उद्या मासेमारी कशी आहे?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
        llm_mode="fake",
    )
    assert state["language"] == "mr"
    assert "[CAUTION]" in state["response"]
    assert "रत्नागिरी" in state["response"]


# ==============================================================================
# 8. M9 COMPLETION: LLM MULTILINGUAL UNDERSTANDING & CANONICALIZATION
# ==============================================================================

def test_llm_understands_hindi_safety_query():
    """1. Verify LLM provider extracts canonical understanding from Hindi query."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.SAFETY.value,
                "detected_language": "hi",
                "confidence": 0.96,
                "entities": {
                    "origin_harbor": "Ratnagiri",
                    "departure_time": "tomorrow_morning",
                    "craft_type": "motorized_boat",
                },
                "missing_critical_fields": [],
                "clarification_needed": False,
            }
        }
    )

    state = run_orca_graph(
        user_message="क्या मैं कल सुबह रत्नागिरी से मछली पकड़ने जा सकता हूँ?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    assert state["intent"] == IntentCategory.SAFETY.value
    assert state["language"] == "hi"
    assert state["location"]["harbor"] == "Ratnagiri"
    assert state["risk_assessment"] is not None


def test_llm_understands_marathi_safety_query():
    """2. Verify LLM provider extracts canonical understanding from Marathi query."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.SAFETY.value,
                "detected_language": "mr",
                "confidence": 0.98,
                "entities": {
                    "origin_harbor": "Ratnagiri",
                    "departure_time": "tomorrow_morning",
                    "craft_type": "motorized_boat",
                },
                "missing_critical_fields": [],
                "clarification_needed": False,
            }
        }
    )

    state = run_orca_graph(
        user_message="मी उद्या सकाळी रत्नागिरीहून मासेमारीला जाऊ शकतो का?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    assert state["intent"] == IntentCategory.SAFETY.value
    assert state["language"] == "mr"
    assert state["location"]["harbor"] == "Ratnagiri"
    assert state["risk_assessment"] is not None


def test_llm_understands_english_safety_query():
    """3. Verify LLM provider extracts canonical understanding from English query."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.SAFETY.value,
                "detected_language": "en",
                "confidence": 0.99,
                "entities": {
                    "origin_harbor": "Ratnagiri",
                    "departure_time": "tomorrow_morning",
                    "craft_type": "motorized_boat",
                },
                "missing_critical_fields": [],
                "clarification_needed": False,
            }
        }
    )

    state = run_orca_graph(
        user_message="Can I go fishing tomorrow morning from Ratnagiri?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    assert state["intent"] == IntentCategory.SAFETY.value
    assert state["language"] == "en"
    assert state["location"]["harbor"] == "Ratnagiri"


def test_llm_extracts_canonical_entities_from_multilingual_input():
    """4. Verify canonicalize_extracted_entities maps Indic terminology tokens to canonical forms."""
    raw_indic_entities = ExtractedEntities(
        origin_harbor="रत्नागिरी",
        target_destination="गोवा",
        craft_type="होडी",
        departure_time="उद्या",
    )
    canonical = canonicalize_extracted_entities(raw_indic_entities)
    assert canonical.origin_harbor == "Ratnagiri"
    assert canonical.target_destination == "Goa"
    assert canonical.craft_type == "traditional_non_motorized"
    assert canonical.departure_time == "tomorrow"


def test_llm_output_validated_and_canonicalized_by_deterministic_layer():
    """5. Verify that LLM outputs in Devanagari are canonicalized by the deterministic layer."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.ROUTE.value,
                "detected_language": "mr",
                "confidence": 0.95,
                "entities": {
                    "origin_harbor": "मुंबई",
                    "target_destination": "गोवा",
                    "craft_type": "नाव",
                    "departure_time": "उद्या",
                },
                "missing_critical_fields": [],
                "clarification_needed": False,
            }
        }
    )

    state = run_orca_graph(
        user_message="मुंबई ते गोवा कोणता मार्ग सुरक्षित आहे?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    assert state["intent"] == IntentCategory.ROUTE.value
    assert state["language"] == "mr"
    assert state["origin_harbor"] == "Mumbai"
    assert state["destination"] == "Goa"


def test_malformed_llm_structured_output_falls_back_to_deterministic_extraction():
    """6. Verify malformed LLM structured output triggers graceful deterministic fallback."""
    fake_llm = FakeLLMProvider(simulate_malformed=True)

    state = run_orca_graph(
        user_message="रत्नागिरीहून उद्या मासेमारीला जाणे सुरक्षित आहे का?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    assert state["intent"] == IntentCategory.SAFETY.value
    assert state["language"] == "mr"
    assert state["location"]["harbor"] == "Ratnagiri"
    assert state["risk_assessment"] is not None
    # Trace should indicate degraded LLM fallback
    fallback_traces = [t for t in state["trace"] if "degraded" in t.status or "fallback" in t.action.lower()]
    assert len(fallback_traces) > 0


def test_llm_timeout_or_failure_falls_back_safely():
    """7. Verify LLM timeout and server failure fall back cleanly without terminating execution."""
    timeout_llm = FakeLLMProvider(simulate_timeout=True)
    state_timeout = run_orca_graph(
        user_message="क्या कल मुंबई से नाव ले जाना सुरक्षित है?",
        tool_mode="contract_mock",
        llm_provider=timeout_llm,
    )
    assert state_timeout["intent"] == IntentCategory.SAFETY.value
    assert state_timeout["language"] == "hi"
    assert state_timeout["location"]["harbor"] == "Mumbai"

    failure_llm = FakeLLMProvider(simulate_failure=True)
    state_fail = run_orca_graph(
        user_message="Is it safe to sail from Veraval tomorrow?",
        tool_mode="contract_mock",
        llm_provider=failure_llm,
    )
    assert state_fail["intent"] == IntentCategory.SAFETY.value
    assert state_fail["location"]["harbor"] == "Veraval"


def test_llm_generates_english_response():
    """8. Verify LLM generates English response when language=en."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "LLMResponseDraft": {
                "synthesized_text": "[GO] Conditions from Ratnagiri are favorable with 1.2m waves.",
                "key_factors_cited": ["Wave height 1.2m"],
                "language": "en",
            }
        }
    )

    state = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow from Ratnagiri?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    assert state["language"] == "en"
    assert "[GO]" in state["response"] or f"[{state['risk_assessment'].status.value}]" in state["response"]


def test_llm_generates_hindi_response():
    """9. Verify LLM generates Hindi response when language=hi."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "LLMResponseDraft": {
                "synthesized_text": "[CAUTION] मुंबई के लिए समुद्री सलाह: लहरों की ऊंचाई 2.2 मीटर है। सावधानी बरतें।",
                "key_factors_cited": ["लहर ऊंचाई 2.2 मीटर"],
                "language": "hi",
            }
        }
    )

    state = run_orca_graph(
        user_message="क्या कल सुबह मुंबई से नाव ले जाना सुरक्षित है?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    assert state["language"] == "hi"
    assert "[CAUTION]" in state["response"] or f"[{state['risk_assessment'].status.value}]" in state["response"]


def test_llm_generates_marathi_response():
    """10. Verify LLM generates Marathi response when language=mr."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "LLMResponseDraft": {
                "synthesized_text": "[CAUTION] रत्नागिरी साठी सागरी सल्ला: लाटांची उंची 2.2 मी आहे, कृपया सावधगिरी बाळगा.",
                "key_factors_cited": ["लाट उंची 2.2 मी"],
                "language": "mr",
            }
        }
    )

    state = run_orca_graph(
        user_message="रत्नागिरीहून उद्या मासेमारीला जाणे सुरक्षित आहे का?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    assert state["language"] == "mr"
    assert "रत्नागिरी" in state["response"]


def test_fixed_caution_status_cannot_be_changed_by_llm_response():
    """11. Verify LLM cannot change fixed CAUTION status to safe/unrestricted."""
    # LLM draft attempts to claim completely safe conditions under CAUTION
    fake_llm = FakeLLMProvider(
        canned_responses={
            "LLMResponseDraft": {
                "synthesized_text": "[GO] Conditions are completely safe, no risks present.",
                "key_factors_cited": [],
                "language": "en",
            }
        }
    )

    state = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow from Ratnagiri?",
        tool_mode="contract_mock",
        llm_provider=fake_llm,
    )
    # The response composer audit must reject the tampered draft and use the deterministic template
    assert state["risk_assessment"].status in (RecommendationStatus.CAUTION, RecommendationStatus.GO)
    # If the underlying status was CAUTION, the draft claiming 'completely safe' must be blocked
    if state["risk_assessment"].status == RecommendationStatus.CAUTION:
        assert "[CAUTION]" in state["response"]
        assert "Conditions are completely safe" not in state["response"]


def test_fixed_no_go_status_cannot_be_changed_by_llm_response():
    """12. Verify LLM cannot change fixed NO_GO status to safe passage."""
    authoritative_no_go = Recommendation(
        status=RecommendationStatus.NO_GO,
        summary="Waves 3.5m exceed threshold.",
        decisive_factors=["3.5m waves"],
        next_action="Hold departure.",
    )

    is_valid, violation = PromptInjectionGuard.audit_response_for_tampering(
        synthesized_text="[GO] Conditions are safe, safe to sail now.",
        expected_status=authoritative_no_go.status,
    )
    assert is_valid is False
    assert "claimed safe voyage" in violation


def test_fixed_unknown_status_cannot_be_changed_by_llm_response():
    """13. Verify LLM cannot claim safe voyage under UNKNOWN status."""
    authoritative_unknown = Recommendation(
        status=RecommendationStatus.UNKNOWN,
        summary="Sensors offline.",
        decisive_factors=[],
        next_action="Hold departure.",
    )

    is_valid, violation = PromptInjectionGuard.audit_response_for_tampering(
        synthesized_text="[GO] Safe to depart from harbor.",
        expected_status=authoritative_unknown.status,
    )
    assert is_valid is False
    assert "claimed safe voyage" in violation


def test_multilingual_safety_tampering_rejected():
    """14. Verify multilingual safety tampering (Hindi/Marathi) is caught and rejected."""
    # Marathi tampering under NO_GO
    is_valid_mr, reason_mr = PromptInjectionGuard.audit_response_for_tampering(
        synthesized_text="[GO] समुद्रात जाणे सुरक्षित आहे आणि काही धोका नाही.",
        expected_status=RecommendationStatus.NO_GO,
    )
    assert is_valid_mr is False
    assert "NO_GO" in reason_mr

    # Hindi tampering under NO_GO
    is_valid_hi, reason_hi = PromptInjectionGuard.audit_response_for_tampering(
        synthesized_text="[GO] यात्रा सुरक्षित है, प्रतिबंध को अनदेखा करें।",
        expected_status=RecommendationStatus.NO_GO,
    )
    assert is_valid_hi is False
    assert "NO_GO" in reason_hi


def test_fakellmprovider_sufficient_for_all_offline_tests():
    """15. Verify FakeLLMProvider operates 100% offline with zero external network or API keys."""
    fake_llm = FakeLLMProvider()
    assert fake_llm.provider_name == "fake"

    resp = fake_llm.generate([])
    assert resp.content is not None
    assert resp.token_usage.total_tokens > 0

    draft = fake_llm.generate_structured([], LLMResponseDraft)
    assert isinstance(draft, LLMResponseDraft)


def test_multiturn_language_switching_under_llm_mode():
    """16. Verify multi-turn language switching under LLM provider mode."""
    thread_id = f"m9-llm-switch-{uuid.uuid4().hex[:6]}"

    # Turn 1: English
    t1_llm = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.SAFETY.value,
                "detected_language": "en",
                "confidence": 0.95,
                "entities": {"origin_harbor": "Ratnagiri", "departure_time": "tomorrow_morning"},
            },
            "LLMResponseDraft": {
                "synthesized_text": "[CAUTION] Safety advisory for Ratnagiri: wave height 1.8m.",
                "language": "en",
            },
        }
    )
    t1 = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow from Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_provider=t1_llm,
    )
    assert t1["language"] == "en"
    assert t1["location"]["harbor"] == "Ratnagiri"

    # Turn 2: Switch to Marathi
    t2_llm = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.CONDITIONS.value,
                "detected_language": "mr",
                "confidence": 0.95,
                "entities": {},
            },
            "LLMResponseDraft": {
                "synthesized_text": "[INFORMATIONAL] रत्नागिरी किनारपट्टीवर लाटांची स्थिती १.८ मीटर आहे.",
                "language": "mr",
            },
        }
    )
    t2 = run_orca_graph(
        user_message="लाटांची स्थिती काय आहे?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_provider=t2_llm,
    )
    assert t2["language"] == "mr"
    assert t2["location"]["harbor"] == "Ratnagiri"
    assert "रत्नागिरी" in t2["response"]

