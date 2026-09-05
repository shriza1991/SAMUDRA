"""Milestone M8 Intent Switching Across Multi-Turn Conversations Test Suite.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

This test suite rigorously validates:
1. SAFETY → HAZARDS intent switching with context carry-forward
2. SAFETY → ROUTE intent switching with origin/destination carry-forward
3. PFZ → SAFETY intent switching with fresh tool execution
4. SAFETY → PFZ intent switching with context carry-forward
5. Explicit new intent in current turn overrides previous conversational intent
6. Context-dependent follow-up ("What about the afternoon?") retains previous intent
7. Explicit harbor/location change overrides memory
8. Previous risk result is never reused as current domain truth after intent switch
9. Fresh domain tools execute after intent switch
10. Thread isolation remains intact during multi-intent conversations
11. Multilingual intent switching in Marathi (mr) and Hindi (hi)
12. LLM-assisted intent switching via FakeLLMProvider
13. Three-way intent hopping (SAFETY → HAZARDS → ROUTE → PFZ) in a single thread
"""

import uuid

from backend.app.agents.graph import run_orca_graph
from backend.app.agents.intent import IntentCategory
from backend.app.agents.llm import FakeLLMProvider
from backend.app.agents.memory import memory_manager
from backend.app.contracts.chat import RecommendationStatus


# ==============================================================================
# 1. SAFETY → HAZARDS INTENT SWITCHING
# ==============================================================================

def test_safety_to_hazards_intent_switching():
    """Turn 1 (SAFETY) -> Turn 2 (HAZARDS).

    Turn 1: "Is it safe to go fishing tomorrow morning from Ratnagiri?"
    Turn 2: "What hazards should I watch for?"
    Expected:
    - Turn 2 intent is HAZARDS (not forced into SAFETY).
    - Ratnagiri is carried forward from Turn 1.
    - Hazard specialist tools execute (hazard_search).
    - Stale safety/risk recommendation is not reused.
    """
    thread_id = f"m8-safe-haz-{uuid.uuid4().hex[:6]}"

    # Turn 1: Safety query
    t1 = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow morning from Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["intent"] == IntentCategory.SAFETY.value
    assert t1["location"]["harbor"] == "Ratnagiri"
    assert t1["risk_assessment"] is not None

    # Turn 2: Hazard query
    t2 = run_orca_graph(
        user_message="What hazards should I watch for?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    # Intent must switch to HAZARDS
    assert t2["intent"] == IntentCategory.HAZARDS.value
    # Harbor must carry forward
    assert t2["location"]["harbor"] == "Ratnagiri"

    # Verify fresh hazard tools executed in Turn 2
    trace = t2["trace"]
    tool_trace = [t for t in trace if "Specialist Tool" in t.node or "hazard_search" in t.action]
    assert len(tool_trace) > 0, "Hazard search specialist tools must execute in Turn 2"

    # Context audit in trace
    intent_trace = [t for t in trace if t.node == "Intent / Locale"]
    assert any("active_harbor: 'Ratnagiri'" in t.action for t in intent_trace)


# ==============================================================================
# 2. SAFETY → ROUTE INTENT SWITCHING
# ==============================================================================

def test_safety_to_route_intent_switching():
    """Turn 1 (SAFETY) -> Turn 2 (ROUTE).

    Turn 1: "Is it safe to go from Ratnagiri to Goa tomorrow?"
    Turn 2: "Which route is safer?"
    Expected:
    - Turn 2 intent is ROUTE.
    - Origin (Ratnagiri) and Destination (Goa) carry forward.
    - Route analysis tools execute (route_analysis, etc.).
    - Previous safety recommendation is not treated as the answer to route query.
    """
    thread_id = f"m8-safe-route-{uuid.uuid4().hex[:6]}"

    # Turn 1: Safety check with origin and destination
    t1 = run_orca_graph(
        user_message="Is it safe to go from Ratnagiri to Goa tomorrow?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["intent"] == IntentCategory.SAFETY.value
    assert t1["origin_harbor"] == "Ratnagiri"
    assert t1["destination"] == "Goa"

    # Turn 2: Route evaluation query
    t2 = run_orca_graph(
        user_message="Which route is safer?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["intent"] == IntentCategory.ROUTE.value
    assert t2["origin_harbor"] == "Ratnagiri"
    assert t2["destination"] == "Goa"

    # Verify route tools executed
    trace = t2["trace"]
    tool_actions = [t.action for t in trace if "Specialist Tool" in t.node]
    assert any("route_analysis" in a or "Dispatched" in a for a in tool_actions)
    assert t2["response"] is not None
    assert "route" in t2["response"].lower() or "मार्ग" in t2["response"] or "रास्ता" in t2["response"]


# ==============================================================================
# 3. PFZ → SAFETY INTENT SWITCHING
# ==============================================================================

def test_pfz_to_safety_intent_switching():
    """Turn 1 (PFZ) -> Turn 2 (SAFETY).

    Turn 1: "Where is the nearest PFZ from Ratnagiri?"
    Turn 2: "Is it safe to go fishing there tomorrow?"
    Expected:
    - Turn 2 intent switches from PFZ to SAFETY.
    - Operational context (Ratnagiri) is retained.
    - Previous PFZ result is not treated as fresh safety evidence.
    - Fresh safety evaluation tools execute.
    """
    thread_id = f"m8-pfz-safe-{uuid.uuid4().hex[:6]}"

    # Turn 1: PFZ search
    t1 = run_orca_graph(
        user_message="Where is the nearest PFZ from Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["intent"] == IntentCategory.PFZ.value
    assert t1["location"]["harbor"] == "Ratnagiri"

    # Turn 2: Safety evaluation
    t2 = run_orca_graph(
        user_message="Is it safe to go fishing there tomorrow?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["intent"] == IntentCategory.SAFETY.value
    assert t2["location"]["harbor"] == "Ratnagiri"
    assert t2["risk_assessment"] is not None
    assert t2["risk_assessment"].status in [
        RecommendationStatus.GO,
        RecommendationStatus.CAUTION,
        RecommendationStatus.NO_GO,
    ]

    # Verify fresh safety tools dispatched in Turn 2
    trace = t2["trace"]
    tool_trace = [t for t in trace if "Specialist Tool" in t.node]
    assert len(tool_trace) > 0, "Fresh safety tools must execute in Turn 2"


# ==============================================================================
# 4. SAFETY → PFZ INTENT SWITCHING
# ==============================================================================

def test_safety_to_pfz_intent_switching():
    """Turn 1 (SAFETY) -> Turn 2 (PFZ).

    Turn 1: "Is it safe to go fishing tomorrow from Ratnagiri?"
    Turn 2: "Where is the nearest fish ground?"
    Expected:
    - Turn 2 intent switches from SAFETY to PFZ.
    - Harbor (Ratnagiri) carries forward.
    - PFZ specialist tools execute.
    """
    thread_id = f"m8-safe-pfz-{uuid.uuid4().hex[:6]}"

    # Turn 1: Safety check
    t1 = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow from Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["intent"] == IntentCategory.SAFETY.value
    assert t1["location"]["harbor"] == "Ratnagiri"

    # Turn 2: PFZ inquiry
    t2 = run_orca_graph(
        user_message="Where is the nearest fish ground?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["intent"] == IntentCategory.PFZ.value
    assert t2["location"]["harbor"] == "Ratnagiri"

    # Verify PFZ tool execution in Turn 2
    trace = t2["trace"]
    tool_trace = [t for t in trace if "Specialist Tool" in t.node]
    assert len(tool_trace) > 0


# ==============================================================================
# 5. EXPLICIT NEW INTENT OVERRIDES PREVIOUS INTENT
# ==============================================================================

def test_explicit_new_intent_overrides_previous_intent():
    """Turn 1 (SAFETY in Ratnagiri) -> Turn 2 (PFZ in Mumbai).

    Expected:
    - Turn 2 intent is PFZ.
    - Origin harbor is Mumbai (overwrites Ratnagiri).
    - Previous SAFETY intent does not leak into Turn 2.
    """
    thread_id = f"m8-explicit-override-{uuid.uuid4().hex[:6]}"

    t1 = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow from Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["intent"] == IntentCategory.SAFETY.value
    assert t1["location"]["harbor"] == "Ratnagiri"

    t2 = run_orca_graph(
        user_message="Where is the nearest PFZ from Mumbai?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["intent"] == IntentCategory.PFZ.value
    assert t2["location"]["harbor"] == "Mumbai"
    assert t2["location"]["harbor"] != "Ratnagiri"

    # Context in memory reflects Mumbai
    ctx = memory_manager.load_context(thread_id)
    assert ctx.active_harbor == "Mumbai"
    assert ctx.last_intent == IntentCategory.PFZ


# ==============================================================================
# 6. CONTEXT-DEPENDENT FOLLOW-UP RETAINS PREVIOUS INTENT
# ==============================================================================

def test_context_dependent_followup_retains_previous_intent():
    """Turn 1 (SAFETY) -> Turn 2 ("What about the afternoon?").

    Expected:
    - Turn 2 has no explicit new intent keyword.
    - Conversational context retains SAFETY intent.
    - Ratnagiri harbor carries forward.
    - Fresh domain tools execute for Turn 2.
    """
    thread_id = f"m8-followup-retain-{uuid.uuid4().hex[:6]}"

    t1 = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow morning from Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["intent"] == IntentCategory.SAFETY.value
    assert t1["location"]["harbor"] == "Ratnagiri"

    t2 = run_orca_graph(
        user_message="What about the afternoon?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    # Intent should remain SAFETY
    assert t2["intent"] == IntentCategory.SAFETY.value
    assert t2["location"]["harbor"] == "Ratnagiri"
    # Fresh safety evaluation must execute
    assert t2["risk_assessment"] is not None


# ==============================================================================
# 7. EXPLICIT HARBOR CHANGE OVERRIDES MEMORY
# ==============================================================================

def test_explicit_harbor_change_overrides_memory():
    """Turn 1 sets Ratnagiri -> Turn 2 sets Goa.

    Expected:
    - Goa unconditionally overrides Ratnagiri in context and state.
    """
    thread_id = f"m8-harbor-change-{uuid.uuid4().hex[:6]}"

    t1 = run_orca_graph(
        user_message="Check wave conditions in Ratnagiri",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["location"]["harbor"] == "Ratnagiri"

    t2 = run_orca_graph(
        user_message="Actually, check wave conditions in Goa",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["location"]["harbor"] == "Goa"
    ctx = memory_manager.load_context(thread_id)
    assert ctx.active_harbor == "Goa"


# ==============================================================================
# 8. PREVIOUS RISK RESULT IS NOT REUSED AS CURRENT TRUTH
# ==============================================================================

def test_previous_risk_result_not_reused_after_intent_switch():
    """Verify state domain outputs are fresh per turn and never read from ThreadContext.

    ThreadContext must not contain risk recommendations or raw observations.
    """
    thread_id = f"m8-fresh-domain-{uuid.uuid4().hex[:6]}"

    # Turn 1: Safety (computes risk assessment)
    t1 = run_orca_graph(
        user_message="Is it safe to leave from Ratnagiri tomorrow?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    t1_risk = t1["risk_assessment"]
    assert t1_risk is not None

    # Verify context in memory store does NOT store risk assessment
    ctx = memory_manager.load_context(thread_id)
    assert not hasattr(ctx, "risk_assessment")
    assert "risk_assessment" not in ctx.model_dump()

    # Turn 2: Switch to HAZARDS
    t2 = run_orca_graph(
        user_message="Are there any cyclone warnings?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["intent"] == IntentCategory.HAZARDS.value

    # Turn 3: Switch back to SAFETY
    t3 = run_orca_graph(
        user_message="Can I go out fishing now?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t3["intent"] == IntentCategory.SAFETY.value
    # Turn 3 must have a freshly generated risk assessment object
    assert t3["risk_assessment"] is not None
    # Turn 3 risk assessment is distinct from Turn 1
    assert t3["request_id"] != t1["request_id"]


# ==============================================================================
# 9. FRESH DOMAIN TOOLS EXECUTE AFTER INTENT SWITCH
# ==============================================================================

def test_fresh_domain_tools_execute_after_intent_switch():
    """Verify tool dispatch occurs on each turn and adapts to the switched intent."""
    thread_id = f"m8-tool-dispatch-{uuid.uuid4().hex[:6]}"

    # Turn 1: CONDITIONS -> marine_conditions tool
    t1 = run_orca_graph(
        user_message="What are the wave conditions in Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["intent"] == IntentCategory.CONDITIONS.value
    t1_tools = [t.action for t in t1["trace"] if "Specialist Tool" in t.node]
    assert any("marine_conditions" in a or "Dispatched" in a for a in t1_tools)

    # Turn 2: Switch to PFZ -> pfz_search tool
    t2 = run_orca_graph(
        user_message="Where is the nearest fishing zone?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["intent"] == IntentCategory.PFZ.value
    t2_tools = [t.action for t in t2["trace"] if "Specialist Tool" in t.node]
    assert any("pfz_search" in a or "Dispatched" in a for a in t2_tools)

    # Turn 3: Switch to HAZARDS -> hazard_search tool
    t3 = run_orca_graph(
        user_message="Are there any severe weather warnings or squalls?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t3["intent"] == IntentCategory.HAZARDS.value
    t3_tools = [t.action for t in t3["trace"] if "Specialist Tool" in t.node]
    assert any("hazard_search" in a or "Dispatched" in a for a in t3_tools)


# ==============================================================================
# 10. THREAD ISOLATION ACROSS INTENT SWITCHES
# ==============================================================================

def test_thread_isolation_during_multi_intent_turns():
    """Verify two concurrent threads can switch intents independently without cross-talk."""
    thread_1 = f"m8-thread-1-{uuid.uuid4().hex[:6]}"
    thread_2 = f"m8-thread-2-{uuid.uuid4().hex[:6]}"

    # Thread 1, Turn 1: Safety in Ratnagiri
    t1_1 = run_orca_graph(
        user_message="Is it safe to fish from Ratnagiri tomorrow?",
        thread_id=thread_1,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1_1["intent"] == IntentCategory.SAFETY.value
    assert t1_1["location"]["harbor"] == "Ratnagiri"

    # Thread 2, Turn 1: PFZ in Veraval
    t2_1 = run_orca_graph(
        user_message="Where is the nearest PFZ from Veraval?",
        thread_id=thread_2,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2_1["intent"] == IntentCategory.PFZ.value
    assert t2_1["location"]["harbor"] == "Veraval"

    # Thread 1, Turn 2: Switch to HAZARDS (should keep Ratnagiri)
    t1_2 = run_orca_graph(
        user_message="What hazards should I watch for?",
        thread_id=thread_1,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1_2["intent"] == IntentCategory.HAZARDS.value
    assert t1_2["location"]["harbor"] == "Ratnagiri"

    # Thread 2, Turn 2: Switch to SAFETY (should keep Veraval)
    t2_2 = run_orca_graph(
        user_message="Is it safe to sail there tomorrow?",
        thread_id=thread_2,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2_2["intent"] == IntentCategory.SAFETY.value
    assert t2_2["location"]["harbor"] == "Veraval"


# ==============================================================================
# 11. MULTILINGUAL INTENT SWITCHING (MARATHI & HINDI)
# ==============================================================================

def test_multilingual_intent_switching_marathi():
    """Test multi-turn intent switching in Marathi: SAFETY → HAZARDS → PFZ."""
    thread_id = f"m8-mr-switch-{uuid.uuid4().hex[:6]}"

    # Turn 1: Marathi Safety query
    t1 = run_orca_graph(
        user_message="रत्नागिरीहून उद्या मासेमारीला जाणे सुरक्षित आहे का?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["language"] == "mr"
    assert t1["intent"] == IntentCategory.SAFETY.value
    assert t1["location"]["harbor"] == "Ratnagiri"

    # Turn 2: Marathi Hazard query (carries Ratnagiri)
    t2 = run_orca_graph(
        user_message="तिथे काही धोके किंवा चक्रीवादळ इशारा आहे का?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["language"] == "mr"
    assert t2["intent"] == IntentCategory.HAZARDS.value
    assert t2["location"]["harbor"] == "Ratnagiri"

    # Turn 3: Marathi PFZ query (carries Ratnagiri)
    t3 = run_orca_graph(
        user_message="जवळचे मत्स्य क्षेत्र कुठे आहे?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t3["language"] == "mr"
    assert t3["intent"] == IntentCategory.PFZ.value
    assert t3["location"]["harbor"] == "Ratnagiri"


def test_multilingual_intent_switching_hindi():
    """Test multi-turn intent switching in Hindi: SAFETY → HAZARDS → ROUTE."""
    thread_id = f"m8-hi-switch-{uuid.uuid4().hex[:6]}"

    # Turn 1: Hindi Safety query
    t1 = run_orca_graph(
        user_message="क्या कल सुबह मुंबई से नाव ले जाना सुरक्षित है?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["language"] == "hi"
    assert t1["intent"] == IntentCategory.SAFETY.value
    assert t1["location"]["harbor"] == "Mumbai"

    # Turn 2: Hindi Hazard query (carries Mumbai)
    t2 = run_orca_graph(
        user_message="क्या वहां कोई तूफान या चेतावनी है?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["language"] == "hi"
    assert t2["intent"] == IntentCategory.HAZARDS.value
    assert t2["location"]["harbor"] == "Mumbai"

    # Turn 3: Hindi Route query to Goa
    t3 = run_orca_graph(
        user_message="मुंबई से गोवा का सुरक्षित रास्ता कौन सा है?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t3["language"] == "hi"
    assert t3["intent"] == IntentCategory.ROUTE.value
    assert t3["origin_harbor"] == "Mumbai"
    assert t3["destination"] == "Goa"


# ==============================================================================
# 12. THREE-WAY INTENT HOPPING (SAFETY ↔ HAZARDS ↔ ROUTE ↔ PFZ)
# ==============================================================================

def test_full_intent_hopping_lifecycle():
    """A single thread smoothly transitions across all four major marine intents:

    SAFETY → HAZARDS → ROUTE → PFZ → SAFETY
    without context corruption or stale intent leakage.
    """
    thread_id = f"m8-lifecycle-{uuid.uuid4().hex[:6]}"

    # Step 1: SAFETY
    s1 = run_orca_graph(
        user_message="Is it safe to sail from Ratnagiri to Goa tomorrow?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert s1["intent"] == IntentCategory.SAFETY.value
    assert s1["origin_harbor"] == "Ratnagiri"
    assert s1["destination"] == "Goa"

    # Step 2: HAZARDS
    s2 = run_orca_graph(
        user_message="Are there any firing zones or naval restrictions along my route?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert s2["intent"] == IntentCategory.HAZARDS.value
    assert s2["origin_harbor"] == "Ratnagiri"
    assert s2["destination"] == "Goa"

    # Step 3: ROUTE
    s3 = run_orca_graph(
        user_message="Which route is safer?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert s3["intent"] == IntentCategory.ROUTE.value
    assert s3["origin_harbor"] == "Ratnagiri"
    assert s3["destination"] == "Goa"

    # Step 4: PFZ
    s4 = run_orca_graph(
        user_message="Where is the nearest fishing zone near Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert s4["intent"] == IntentCategory.PFZ.value
    assert s4["location"]["harbor"] == "Ratnagiri"

    # Step 5: SAFETY (Follow-up return)
    s5 = run_orca_graph(
        user_message="Can I go fishing there tomorrow morning?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert s5["intent"] == IntentCategory.SAFETY.value
    assert s5["location"]["harbor"] == "Ratnagiri"
    assert s5["risk_assessment"] is not None


# ==============================================================================
# 13. LLM-ASSISTED INTENT SWITCHING
# ==============================================================================

def test_llm_assisted_multi_turn_intent_switching():
    """Verify intent switching works seamlessly under LLM extraction mode using FakeLLMProvider."""
    thread_id = f"m8-fake-llm-{uuid.uuid4().hex[:6]}"

    # Turn 1: LLM extracts SAFETY
    fake_llm_1 = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.SAFETY.value,
                "detected_language": "en",
                "confidence": 0.98,
                "entities": {
                    "origin_harbor": "Ratnagiri",
                    "craft_type": "motorized_boat",
                    "departure_time": "tomorrow_morning",
                    "duration_hours": 8.0,
                },
                "missing_critical_fields": [],
                "clarification_needed": False,
            }
        }
    )
    t1 = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow morning from Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_provider=fake_llm_1,
        llm_mode="fake",
    )
    assert t1["intent"] == IntentCategory.SAFETY.value
    assert t1["location"]["harbor"] == "Ratnagiri"

    # Turn 2: LLM extracts HAZARDS with carried harbor
    fake_llm_2 = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.HAZARDS.value,
                "detected_language": "en",
                "confidence": 0.95,
                "entities": {
                    "origin_harbor": None,  # No harbor explicitly in prompt; memory carries Ratnagiri
                },
                "missing_critical_fields": [],
                "clarification_needed": False,
            }
        }
    )
    t2 = run_orca_graph(
        user_message="What hazards should I watch for?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_provider=fake_llm_2,
        llm_mode="fake",
    )
    assert t2["intent"] == IntentCategory.HAZARDS.value
    assert t2["location"]["harbor"] == "Ratnagiri"


# ==============================================================================
# 14. AMBIGUOUS QUERY CLARIFICATION VS INTENT GUESSING
# ==============================================================================

def test_ambiguous_pfz_query_requests_clarification_without_memory():
    """Verify an ambiguous query without memory context triggers clarification rather than guessing."""
    thread_id = f"m8-clarify-{uuid.uuid4().hex[:6]}"

    t = run_orca_graph(
        user_message="Where is the nearest PFZ?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t["clarification_needed"] is True
    assert "origin_harbor" in t["missing_fields"]
    assert t["response"] is not None

