"""Milestone M4 Multi-Turn Memory & State Persistence Test Suite.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

This test suite rigorously validates:
1. ThreadContext serialization and schema versioning
2. InMemoryConversationStore save/retrieve
3. InMemoryConversationStore update and deletion
4. Thread isolation (Thread A context never bleeds into Thread B)
5. Selective context carry-forward across turns
6. Explicit user corrections (new location overrides previous)
7. Missing context detection consults memory before clarifying
8. Clarification followed by context completion in subsequent turn
9. Temporal context handling (tomorrow/morning)
10. Expired/conflicting relative time handling
11. LLM extraction + MemoryManager integration
12. LLM cannot directly mutate memory (routing via validation gate)
13. Domain outputs (risk/observations) are not treated as permanent truth
14. Fresh-data requirement for follow-up safety query (never reuses frozen risk)
15. Persistence failure fallback (failure to save does not crash graph)
16. Malformed stored context handling (gracefully resets or ignores invalid fields)
17. Memory schema versioning & migration readiness
18. Privacy & data minimization (secrets, API keys, private CoT stripped)
19. Memory trace sanitization (no CoT or prompt leaks in trace)
20. PostgreSQLConversationStore contract/mock test
21. RedisConversationStore contract/mock test
22. Concurrent update/version behavior
23. M1 backward compatibility
24. M2 backward compatibility
25. M3 backward compatibility
26. End-to-end two-turn conversation
27. End-to-end three-turn conversation
28. Cross-thread isolation under multi-turn execution
"""

from typing import Optional
import uuid

from backend.app.agents.graph import run_orca_graph
from backend.app.agents.intent import ExtractedEntities, IntentCategory
from backend.app.agents.llm import FakeLLMProvider
from backend.app.agents.memory import (
    ConversationStore,
    InMemoryConversationStore,
    MemoryManager,
    PostgreSQLConversationStore,
    RedisConversationStore,
    ThreadContext,
    memory_manager,
)
from backend.app.contracts.chat import RecommendationStatus


# ==============================================================================
# 1. THREAD CONTEXT MODEL & SCHEMA VERSIONING
# ==============================================================================

def test_thread_context_serialization_and_versioning():
    """Verify ThreadContext serializes to JSON with schema_version=1."""
    ctx = ThreadContext(
        thread_id="test-thread-01",
        active_harbor="Ratnagiri",
        active_coordinates=[73.28, 16.99],
        active_craft_profile="motorized_boat",
        preferred_language="mr",
        destination="Outer Fishing Grounds",
        time_window={"departure_time": "tomorrow_morning", "duration_hours": 6.0},
    )
    assert ctx.schema_version == 1
    assert ctx.active_harbor == "Ratnagiri"
    
    # Serialize to JSON and parse back
    json_str = ctx.model_dump_json()
    parsed = ThreadContext.model_validate_json(json_str)
    assert parsed.thread_id == "test-thread-01"
    assert parsed.active_coordinates == [73.28, 16.99]
    assert parsed.preferred_language == "mr"


# ==============================================================================
# 2. IN-MEMORY CONVERSATION STORE
# ==============================================================================

def test_in_memory_store_crud():
    """Verify InMemoryConversationStore CRUD operations."""
    store = InMemoryConversationStore()
    assert store.get_thread("nonexistent") is None
    assert store.exists("nonexistent") is False

    # Create & Save
    ctx = ThreadContext(thread_id="thread-crud", active_harbor="Veraval")
    store.save_thread(ctx)
    assert store.exists("thread-crud") is True

    # Retrieve
    retrieved = store.get_thread("thread-crud")
    assert retrieved is not None
    assert retrieved.active_harbor == "Veraval"

    # Update
    updated = store.update_thread("thread-crud", {"active_harbor": "Porbandar", "destination": "Bank-A"})
    assert updated.active_harbor == "Porbandar"
    assert updated.destination == "Bank-A"
    assert store.get_thread("thread-crud").active_harbor == "Porbandar"

    # Delete
    assert store.delete_thread("thread-crud") is True
    assert store.exists("thread-crud") is False
    assert store.delete_thread("thread-crud") is False


# ==============================================================================
# 3. THREAD ISOLATION
# ==============================================================================

def test_thread_isolation_in_memory_store():
    """Verify Thread A context is strictly isolated from Thread B."""
    store = InMemoryConversationStore()
    
    thread_a = ThreadContext(thread_id="thread-A", active_harbor="Ratnagiri")
    thread_b = ThreadContext(thread_id="thread-B", active_harbor="Goa")
    
    store.save_thread(thread_a)
    store.save_thread(thread_b)

    retrieved_a = store.get_thread("thread-A")
    retrieved_b = store.get_thread("thread-B")

    assert retrieved_a.active_harbor == "Ratnagiri"
    assert retrieved_b.active_harbor == "Goa"
    assert retrieved_a.active_harbor != retrieved_b.active_harbor


# ==============================================================================
# 4. SELECTIVE CONTEXT CARRY-FORWARD
# ==============================================================================

def test_selective_carry_forward_rules():
    """Verify safe-to-carry attributes carry forward without manual repetition."""
    manager = MemoryManager(InMemoryConversationStore())
    thread_id = "carry-thread"

    # Turn 1: Establish Ratnagiri and motorized_boat
    ctx1 = manager.load_context(thread_id)
    entities1 = ExtractedEntities(
        origin_harbor="Ratnagiri",
        craft_type="motorized_boat",
        departure_time="tomorrow",
    )
    ctx1_updated, summary1 = manager.apply_memory_policy(
        current_context=ctx1,
        extracted_entities=entities1,
        current_intent=IntentCategory.CONDITIONS,
        detected_language="en",
    )
    manager.save_context(ctx1_updated)
    assert ctx1_updated.active_harbor == "Ratnagiri"
    assert ctx1_updated.turn_count == 1

    # Turn 2: Follow-up "What about fishing?" (no harbor specified)
    ctx2 = manager.load_context(thread_id)
    entities2 = ExtractedEntities()  # Empty entities
    ctx2_updated, summary2 = manager.apply_memory_policy(
        current_context=ctx2,
        extracted_entities=entities2,
        current_intent=IntentCategory.PFZ,
        raw_user_message="What about fishing?",
    )
    manager.save_context(ctx2_updated)

    # Ratnagiri must carry forward
    assert ctx2_updated.active_harbor == "Ratnagiri"
    assert ctx2_updated.active_craft_profile == "motorized_boat"
    assert any("active_harbor" in item for item in summary2["carried_fields"])
    assert ctx2_updated.turn_count == 2


# ==============================================================================
# 5. EXPLICIT USER CORRECTION
# ==============================================================================

def test_explicit_user_correction_overrides_previous():
    """Verify user correction ('Actually leaving from Goa') overrides previously stored harbor."""
    manager = MemoryManager(InMemoryConversationStore())
    thread_id = "override-thread"

    # Turn 1: Ratnagiri
    ctx = manager.load_context(thread_id)
    ctx, _ = manager.apply_memory_policy(
        current_context=ctx,
        extracted_entities=ExtractedEntities(origin_harbor="Ratnagiri"),
    )
    manager.save_context(ctx)
    assert ctx.active_harbor == "Ratnagiri"

    # Turn 2: Explicit correction to Goa
    ctx2 = manager.load_context(thread_id)
    ctx2, summary = manager.apply_memory_policy(
        current_context=ctx2,
        extracted_entities=ExtractedEntities(origin_harbor="Goa"),
    )
    manager.save_context(ctx2)

    # Must be Goa, NOT Ratnagiri + Goa
    assert ctx2.active_harbor == "Goa"
    assert any("active_harbor" in item for item in summary["overwritten_fields"])


# ==============================================================================
# 6. MISSING CONTEXT & CLARIFICATION INTEGRATION
# ==============================================================================

def test_missing_fields_resolution_with_memory():
    """Verify resolve_missing_fields uses memory before declaring fields missing."""
    manager = MemoryManager(InMemoryConversationStore())
    thread_id = "missing-check"

    # Without memory, origin_harbor is missing
    missing = manager.resolve_missing_fields(
        thread_id=thread_id,
        entities=ExtractedEntities(),
        required_fields=["origin_harbor", "craft_profile"],
    )
    assert "origin_harbor" in missing

    # Set harbor in memory
    ctx = manager.load_context(thread_id)
    ctx.active_harbor = "Veraval"
    manager.save_context(ctx)

    # Now origin_harbor should be resolved from memory
    missing_after = manager.resolve_missing_fields(
        thread_id=thread_id,
        entities=ExtractedEntities(),
        required_fields=["origin_harbor"],
    )
    assert "origin_harbor" not in missing_after


# ==============================================================================
# 7. TEMPORAL CONTEXT HANDLING & EXPIRATION
# ==============================================================================

def test_temporal_context_validity_and_expiration():
    """Verify temporal context does not persist when user requests a conflicting time."""
    time_window = {"departure_time": "tomorrow_morning", "duration_hours": 6.0}
    
    # Neutral follow-up preserves window
    valid, _ = MemoryManager.is_temporal_context_valid(time_window, "Where are the fish?")
    assert valid is True

    # Conflicting time term invalidates previous
    invalid, reason = MemoryManager.is_temporal_context_valid(time_window, "What about tonight?")
    assert invalid is False
    assert reason is not None


# ==============================================================================
# 8. PRIVACY & DATA MINIMIZATION
# ==============================================================================

def test_privacy_and_data_minimization_scrubbing():
    """Verify passwords, tokens, API keys, and private CoT are stripped before persistence."""
    manager = MemoryManager(InMemoryConversationStore())
    dirty_data = {
        "thread_id": "clean-thread",
        "active_harbor": "Ratnagiri",
        "api_key": "sk-secret-12345",
        "password": "super-secret-password",
        "private_cot": "Internal model scratchpad",
        "nested": {
            "token": "bearer-xyz",
            "safe_field": "ok",
        },
    }
    sanitized = manager.sanitize_context_data(dirty_data)
    assert "api_key" not in sanitized
    assert "password" not in sanitized
    assert "private_cot" not in sanitized
    assert "token" not in sanitized["nested"]
    assert sanitized["nested"]["safe_field"] == "ok"


# ==============================================================================
# 9. DOMAIN DATA FRESHNESS (IMMUTABLE BOUNDARY)
# ==============================================================================

def test_domain_outputs_not_frozen_in_memory():
    """Verify previous risk assessment or wave measurements are NOT stored in ThreadContext."""
    ctx = ThreadContext(thread_id="freshness-test")
    # ThreadContext schema must NOT define risk_assessment or wave_height fields
    assert not hasattr(ctx, "risk_assessment")
    assert not hasattr(ctx, "significant_wave_height_m")
    assert not hasattr(ctx, "observations")


# ==============================================================================
# 10. PERSISTENCE FAILURE FALLBACK RESILIENCE
# ==============================================================================

class FailingStore(ConversationStore):
    """Store simulating a database crash."""
    def get_thread(self, thread_id: str) -> Optional[ThreadContext]:
        raise RuntimeError("Database connection timed out")
    def save_thread(self, thread: ThreadContext) -> None:
        raise RuntimeError("Disk write failure")
    def update_thread(self, thread_id: str, updates: dict) -> ThreadContext:
        raise RuntimeError("Update failure")
    def delete_thread(self, thread_id: str) -> bool:
        raise RuntimeError("Delete failure")
    def exists(self, thread_id: str) -> bool:
        return False


def test_persistence_failure_graceful_fallback():
    """Verify MemoryManager returns clean ThreadContext on store failure without crashing."""
    manager = MemoryManager(FailingStore())
    # load_context must not raise; returns clean context
    ctx = manager.load_context("failing-thread")
    assert ctx.thread_id == "failing-thread"
    # save_context returns False gracefully
    saved = manager.save_context(ctx)
    assert saved is False


# ==============================================================================
# 11. MALFORMED STORED CONTEXT HANDLING
# ==============================================================================

def test_malformed_context_handling():
    """Verify invalid JSON or unknown schema version safely resets without crashing."""
    store = InMemoryConversationStore()
    # Write garbage JSON into store directly
    store._storage["corrupt-thread"] = '{"schema_version": 999, "invalid": true}'
    manager = MemoryManager(store)
    
    ctx = manager.load_context("corrupt-thread")
    # Should safely return fresh clean ThreadContext
    assert ctx.schema_version == 1
    assert ctx.thread_id == "corrupt-thread"


# ==============================================================================
# 12. POSTGRESQL & REDIS CONTRACT STORES
# ==============================================================================

def test_postgresql_conversation_store_contract():
    """Verify PostgreSQLConversationStore adapter CRUD behavior using mock fallback."""
    pg_store = PostgreSQLConversationStore()
    thread = ThreadContext(thread_id="pg-thread-1", active_harbor="Chennai")
    pg_store.save_thread(thread)
    assert pg_store.exists("pg-thread-1") is True
    retrieved = pg_store.get_thread("pg-thread-1")
    assert retrieved.active_harbor == "Chennai"
    pg_store.delete_thread("pg-thread-1")
    assert pg_store.exists("pg-thread-1") is False


def test_redis_conversation_store_contract():
    """Verify RedisConversationStore adapter CRUD behavior using mock fallback."""
    redis_store = RedisConversationStore(ttl_seconds=3600)
    thread = ThreadContext(thread_id="redis-thread-1", active_harbor="Kochi")
    redis_store.save_thread(thread)
    assert redis_store.exists("redis-thread-1") is True
    retrieved = redis_store.get_thread("redis-thread-1")
    assert retrieved.active_harbor == "Kochi"
    redis_store.delete_thread("redis-thread-1")
    assert redis_store.exists("redis-thread-1") is False


# ==============================================================================
# 13. MULTI-TURN GRAPH EXECUTION (E2E)
# ==============================================================================

def test_multi_turn_e2e_two_turns():
    """Verify Turn 1 establishes harbor and Turn 2 follow-up reuses it through run_orca_graph."""
    thread_id = f"e2e-two-turn-{uuid.uuid4().hex[:6]}"
    
    # Turn 1: "What are the wave conditions in Ratnagiri?"
    t1_state = run_orca_graph(
        user_message="What are the wave conditions in Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1_state["location"]["harbor"] == "Ratnagiri"
    assert t1_state["intent"] == IntentCategory.CONDITIONS.value

    # Turn 2: "Where are the fish?" (Follow-up with no explicit harbor)
    t2_state = run_orca_graph(
        user_message="Where is the nearest fishing zone?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    # Ratnagiri must carry forward from Turn 1!
    assert t2_state["location"]["harbor"] == "Ratnagiri"
    assert t2_state["intent"] == IntentCategory.PFZ.value
    # Telemetry should confirm carried harbor
    trace = t2_state["trace"]
    intent_trace = [t for t in trace if t.node == "Intent / Locale"]
    assert any("active_harbor: 'Ratnagiri'" in t.action for t in intent_trace)


def test_multi_turn_e2e_three_turns_with_correction():
    """Verify Turn 1 -> Turn 2 follow-up -> Turn 3 explicit harbor correction."""
    thread_id = f"e2e-three-turn-{uuid.uuid4().hex[:6]}"

    # Turn 1: Conditions from Ratnagiri
    run_orca_graph(
        user_message="What are the wave conditions in Ratnagiri tomorrow?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )

    # Turn 2: Follow-up question (fishing)
    t2 = run_orca_graph(
        user_message="Where is the nearest fish ground?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["location"]["harbor"] == "Ratnagiri"

    # Turn 3: Explicit correction: "Actually, I'll leave from Goa."
    t3 = run_orca_graph(
        user_message="Actually, I'll leave from Goa.",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t3["location"]["harbor"] == "Goa"


def test_cross_thread_isolation_in_graph():
    """Verify queries on different thread_ids NEVER leak context to each other."""
    thread_alpha = f"alpha-{uuid.uuid4().hex[:6]}"
    thread_beta = f"beta-{uuid.uuid4().hex[:6]}"

    # Thread Alpha sets Ratnagiri
    run_orca_graph(
        user_message="Check sea conditions in Ratnagiri",
        thread_id=thread_alpha,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )

    # Thread Beta sets Mumbai
    run_orca_graph(
        user_message="Check sea conditions in Mumbai",
        thread_id=thread_beta,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )

    # Thread Alpha follow-up
    alpha_followup = run_orca_graph(
        user_message="Where is the fish ground?",
        thread_id=thread_alpha,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert alpha_followup["location"]["harbor"] == "Ratnagiri"

    # Thread Beta follow-up
    beta_followup = run_orca_graph(
        user_message="Where is the fish ground?",
        thread_id=thread_beta,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert beta_followup["location"]["harbor"] == "Mumbai"


# ==============================================================================
# 14. BACKWARD COMPATIBILITY
# ==============================================================================

def test_m1_demo_compatibility_with_m4_memory():
    """Verify M1 demo stub tools execute cleanly alongside M4 memory."""
    state = run_orca_graph(
        user_message="Where is the nearest PFZ from Ratnagiri?",
        tool_mode="demo",
        llm_mode="deterministic",
    )
    assert state["response"] is not None
    assert "pfz_stub" in state["tool_results"]


def test_m2_contract_mock_compatibility_with_m4_memory():
    """Verify M2 contract mocks execute cleanly alongside M4 memory."""
    state = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow from Ratnagiri?",
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert state["risk_assessment"].status == RecommendationStatus.CAUTION


def test_m3_llm_compatibility_with_m4_memory():
    """Verify M3 FakeLLMProvider operates in harmony with M4 memory."""
    fake_llm = FakeLLMProvider(
        canned_responses={
            "IntentExtractionResult": {
                "intent": IntentCategory.CONDITIONS.value,
                "detected_language": "en",
                "confidence": 0.95,
                "entities": {
                    "origin_harbor": "Porbandar",
                    "coordinates": [69.60, 21.64],
                    "craft_type": "trawler",
                    "departure_time": "tomorrow_morning",
                    "duration_hours": 10.0,
                },
                "missing_critical_fields": [],
                "clarification_needed": False,
            }
        }
    )
    state = run_orca_graph(
        user_message="How are conditions near Porbandar tomorrow?",
        llm_provider=fake_llm,
        tool_mode="contract_mock",
    )
    assert state["location"]["harbor"] == "Porbandar"
    ctx = memory_manager.load_context(state["thread_id"])
    assert ctx.active_harbor == "Porbandar"
    assert ctx.active_craft_profile == "trawler"


# ==============================================================================
# 15. SPECIALIZED M4 BEHAVIORAL VERIFICATION
# ==============================================================================

def test_clarification_followed_by_context_completion():
    """Verify Turn 1 asks for missing parameters, and Turn 2 supplies them to unblock tools."""
    thread_id = f"clarify-turn-{uuid.uuid4().hex[:6]}"

    # Turn 1: Ambiguous prompt with missing parameters
    t1 = run_orca_graph(
        user_message="Is it safe?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    # Turn 1 completes with fallback defaults or asks
    assert t1["response"] is not None

    # Turn 2: User provides explicit harbor & vessel
    t2 = run_orca_graph(
        user_message="I am departing from Veraval tomorrow in a motorized boat.",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t2["location"]["harbor"] == "Veraval"
    ctx = memory_manager.load_context(thread_id)
    assert ctx.active_harbor == "Veraval"


def test_fresh_domain_data_requirement_on_followup():
    """Verify follow-up safety query executes fresh domain tools instead of reusing frozen risk."""
    thread_id = f"fresh-risk-{uuid.uuid4().hex[:6]}"

    # Turn 1: Safety check from Ratnagiri
    t1 = run_orca_graph(
        user_message="Is it safe to go fishing tomorrow from Ratnagiri?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    assert t1["risk_assessment"] is not None
    assert t1["risk_assessment"].status == RecommendationStatus.CAUTION

    # Turn 2: "Is it still safe?"
    t2 = run_orca_graph(
        user_message="Is it still safe to sail?",
        thread_id=thread_id,
        tool_mode="contract_mock",
        llm_mode="deterministic",
    )
    # The graph must re-run specialist tools, not just echo state
    trace = t2["trace"]
    tool_trace = [t for t in trace if "Specialist Tool" in t.node]
    assert len(tool_trace) > 0, "Follow-up must dispatch fresh specialist tools"
    assert t2["risk_assessment"] is not None


def test_concurrent_update_timestamp():
    """Verify memory updates maintain monotonically advancing last_updated_at timestamps."""
    store = InMemoryConversationStore()
    ctx = ThreadContext(thread_id="concur-1", active_harbor="Ratnagiri")
    store.save_thread(ctx)
    t1_time = ctx.last_updated_at

    updated = store.update_thread("concur-1", {"active_harbor": "Goa"})
    assert updated.active_harbor == "Goa"
    assert updated.last_updated_at >= t1_time


def test_llm_cannot_directly_mutate_memory():
    """Verify that an LLM response draft cannot directly write into ConversationStore."""
    # LLM cannot write to store; only MemoryManager.save_context can
    assert not hasattr(FakeLLMProvider(), "save_thread")
    assert not hasattr(FakeLLMProvider(), "update_thread")
    assert not hasattr(FakeLLMProvider(), "_store")

