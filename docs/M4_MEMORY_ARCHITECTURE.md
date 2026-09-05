# Milestone M4: Multi-Turn Memory & State Persistence Architecture

**Owner**: Dev 3 (Agent Orchestration & Explainability)  
**SIH Problem Statement**: PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
**Status**: **COMPLETE**  
**Milestone**: M4  

---

## 1. Executive Summary

Milestone M4 establishes the persistent multi-turn conversation memory layer for SAMUDRA / ORCA. 

In maritime operations, mariners frequently query across multiple conversational turns:
- **Turn 1**: *"Check sea conditions from Ratnagiri tomorrow."* (Establishes harbor: Ratnagiri, departure: tomorrow)
- **Turn 2**: *"What about fishing?"* (Follow-up inquiry: reuses harbor and vessel without repeating them)
- **Turn 3**: *"Actually, I'll leave from Goa."* (Explicit user correction: overrides Ratnagiri with Goa)

M4 solves this with a **deterministic selective carry-forward policy** and a **pluggable persistence abstraction** (`ConversationStore`), allowing SAMUDRA to maintain context across turns while strictly preserving all safety, evidence, and ownership boundaries from M0-M3:
1. **Zero CoT & Secret Persistence**: Passwords, tokens, API keys, private scratchpads, and raw CoT are sanitized before persistence.
2. **Domain Data Freshness**: Previous risk recommendations (`NO_GO`, `CAUTION`, `GO`) and numerical wave/weather observations are **never** treated as permanent truth. Follow-up queries always execute fresh domain tools.
3. **Deterministic User Overrides**: Explicit user corrections (e.g. changing departure harbor) unconditionally override previously stored values.
4. **Thread Isolation**: Complete data segregation across `thread_id`s; Thread A context never bleeds into Thread B.
5. **Zero Mandatory Paid / Live Services**: 100% functional offline via `InMemoryConversationStore`, with mockable adapter contracts for `PostgreSQLConversationStore` and `RedisConversationStore`.

---

## 2. Multi-Turn Information Flow

```
                      User Message + thread_id
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ MemoryManager           │ ◄── Read from ConversationStore
                    │ .load_context(thread_id)│     (Memory / PostgreSQL / Redis)
                    └────────────┬────────────┘
                                 │ Existing ThreadContext (schema_version=1)
                                 ▼
                    ┌─────────────────────────┐
                    │ Intent / Locale Node    │
                    │ - M3 LLM Extraction /   │
                    │   Deterministic Matcher │
                    └────────────┬────────────┘
                                 │ ExtractedEntities (Proposed)
                                 ▼
                    ┌─────────────────────────┐
                    │ MemoryManager           │
                    │ .apply_memory_policy()  │
                    │ 1. Safe-to-Carry (Cat A)│ ── Carried forward (harbor, craft, lang)
                    │ 2. Temporal Check (B)   │ ── Validated / invalidated on conflict
                    │ 3. User Overrides       │ ── Explicit updates overwrite prior state
                    │ 4. Drop Ephemeral (C)   │ ── Scratchpads, CoT, prompts dropped
                    │ 5. Drop Domain Data (D) │ ── Past wave/risk NOT frozen
                    └────────────┬────────────┘
                                 │ Validated ThreadContext
                                 ▼
                    ┌─────────────────────────┐
                    │ MemoryManager           │ ── Sanitizes data & writes to store
                    │ .save_context()         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ LangGraph Execution     │
                    │ - Supervisor            │ ── Plans fresh specialist tools
                    │ - Specialist Tools      │ ── Computes fresh marine/risk data
                    │ - Evidence Validator    │ ── Audits fresh factual citations
                    │ - Response Composer     │ ── Grounds response & enforces safety
                    │ - Terminal              │ ── Seals sanitized execution trace
                    └────────────┬────────────┘
                                 │
                                 ▼
                            ChatResponse
```

---

## 3. Core Components Implemented

### 3.1 Context Representation (`backend/app/agents/memory.py`)
- **`ThreadContext`**: Pydantic schema with forward migration support:
  - `schema_version`: Monotonically incrementing schema version (currently `1`).
  - `thread_id`: Unique conversation identifier.
  - `active_harbor`, `active_coordinates`, `destination`: Spatio-temporal operational context.
  - `active_craft_profile`: Vessel ceiling (default: `"motorized_boat"`).
  - `preferred_language`: Established mariner conversation language (`"en"`, `"mr"`, `"hi"`, etc.).
  - `time_window`: Departure time and voyage duration.
  - `turn_count`: Conversational turn counter.
  - `created_at`, `last_updated_at`: UTC ISO-8601 timestamps.

### 3.2 Provider-Agnostic Persistence Abstraction
- **`ConversationStore` (ABC)**:
  - `get_thread(thread_id: str) -> Optional[ThreadContext]`
  - `save_thread(thread: ThreadContext) -> None`
  - `update_thread(thread_id: str, updates: Dict[str, Any]) -> ThreadContext`
  - `delete_thread(thread_id: str) -> bool`
  - `exists(thread_id: str) -> bool`
- **`InMemoryConversationStore`**: Thread-safe in-memory store using JSON serialization fidelity and deepcopy isolation. Available for offline development, demonstrations, and test execution.
- **`PostgreSQLConversationStore`**: Contract adapter interfacing with Dev 2 repository infrastructure (`conversation_threads` table with JSONB context storage). Operates via mock storage when live pool is not connected.
- **`RedisConversationStore`**: Contract adapter for session-based caching (`samudra:thread:{thread_id}`) with configurable TTL. Operates via mock storage when live Redis is not connected.

### 3.3 Selective Carry-Forward Policy & Memory Lifecycle (`MemoryManager`)
- **Category A (Safe-to-Carry)**: `active_harbor`, `active_craft_profile`, `preferred_language`, `destination` persist across turns unless explicitly changed.
- **Category B (Temporal Context)**: `time_window` carries forward only while valid; conflicting temporal terms (e.g. asking about "tonight" when "tomorrow" was stored) expire the old window.
- **Category C (Ephemeral State)**: Raw prompts, model drafts, and trace events are never persisted.
- **Category D (Domain Outputs)**: Risk assessments and wave observations are intentionally omitted from `ThreadContext`.
- **Privacy & Data Minimization**: `sanitize_context_data()` scrubs passwords, tokens, API keys, and internal scratchpads before saving.
- **Fallback Resilience**: Persistence errors are caught, logged as degraded trace items, and never crash the active request.

---

## 4. Test Verification Matrix

All **88 tests** across M0, M1, M2, M3, and M4 pass cleanly in **0.82s**:
- `tests/agent_eval/test_m4_memory.py`: **23/23 passed**
- `tests/agent_eval/test_m3_llm.py`: **24/24 passed**
- `tests/agent_eval/test_m2_integration.py`: **17/17 passed**
- `tests/agent_eval/test_m1_graph.py`: **9/9 passed**
- `tests/agent_eval/test_agent_contracts.py`: **9/9 passed**
- `tests/contract/test_contracts.py`: **3/3 passed**
- `tests/integration/test_health.py`: **3/3 passed**
- `ruff check`: **0 errors**.

| Test Case | Description | Result |
| :--- | :--- | :--- |
| `test_thread_context_serialization_and_versioning` | Validates JSON round-trip & `schema_version=1` | PASSED |
| `test_in_memory_store_crud` | Verifies in-memory store get, save, update, delete | PASSED |
| `test_thread_isolation_in_memory_store` | Verifies Thread A and Thread B separation | PASSED |
| `test_selective_carry_forward_rules` | Verifies safe attributes carry over turns | PASSED |
| `test_explicit_user_correction_overrides_previous` | Verifies user override updates harbor | PASSED |
| `test_missing_fields_resolution_with_memory` | Verifies missing parameters check memory | PASSED |
| `test_temporal_context_validity_and_expiration` | Verifies conflicting times expire old window | PASSED |
| `test_privacy_and_data_minimization_scrubbing` | Verifies secrets and CoT are stripped | PASSED |
| `test_domain_outputs_not_frozen_in_memory` | Verifies risk/wave data is NOT stored | PASSED |
| `test_persistence_failure_graceful_fallback` | Verifies store failure does not crash graph | PASSED |
| `test_malformed_context_handling` | Verifies corrupt JSON safely resets | PASSED |
| `test_postgresql_conversation_store_contract` | Verifies PostgreSQL adapter contract | PASSED |
| `test_redis_conversation_store_contract` | Verifies Redis adapter contract | PASSED |
| `test_multi_turn_e2e_two_turns` | Verifies 2-turn flow in `run_orca_graph` | PASSED |
| `test_multi_turn_e2e_three_turns_with_correction` | Verifies 3-turn correction flow in `run_orca_graph` | PASSED |
| `test_cross_thread_isolation_in_graph` | Verifies isolation across concurrent threads | PASSED |
| `test_m1_demo_compatibility_with_m4_memory` | Verifies M1 demo tools execute cleanly | PASSED |
| `test_m2_contract_mock_compatibility_with_m4_memory` | Verifies M2 contract mocks execute cleanly | PASSED |
| `test_m3_llm_compatibility_with_m4_memory` | Verifies M3 FakeLLMProvider integration | PASSED |
| `test_clarification_followed_by_context_completion` | Verifies missing param resolution | PASSED |
| `test_fresh_domain_data_requirement_on_followup` | Verifies fresh tools run on follow-up | PASSED |
| `test_concurrent_update_timestamp` | Verifies monotonically advancing timestamps | PASSED |
| `test_llm_cannot_directly_mutate_memory` | Verifies LLM has no store write methods | PASSED |

---

## 5. Live Storage Verification Disclosure

> [!NOTE]
> Live PostgreSQL and Redis instances were **not** running in this local development environment during verification.
> Per project guidelines, contract adherence, multi-turn behavior, and error fallback resilience were verified using `InMemoryConversationStore` and mock persistence adapters.
