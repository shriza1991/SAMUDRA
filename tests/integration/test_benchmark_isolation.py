"""Integration & Regression Tests for Benchmark Runner State Isolation (P0-2).

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

Verifies that ScenarioRunner execution is strictly isolated and does not mutate or leak into:
1. The global AgentToolRegistry (operational tools, handlers, and history).
2. The global MemoryManager conversation store.
3. Subsequent normal operational chat or graph invocations.
"""

from typing import Any, Dict
from unittest.mock import patch
import pytest
from starlette.testclient import TestClient

from backend.app.agents.graph import run_orca_graph
from backend.app.agents.integrations.contracts import ToolInvocationContext, ToolOwner
from backend.app.agents.integrations.dev2 import MarineConditionsPayload
from backend.app.agents.memory import (
    InMemoryConversationStore,
    ThreadContext,
    memory_manager,
)
from backend.app.agents.tools import ToolDefinition, tool_registry
from backend.app.contracts.chat import RecommendationStatus
from backend.app.main import app
from backend.app.scenarios.runner import ScenarioMarineProvider, ScenarioRunner


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


# =============================================================================
# TEST 1 — Registry restored after successful benchmark
# =============================================================================

def test_registry_restored_after_successful_benchmark():
    """TEST 1: Operational registry state must be identical before and after a benchmark."""
    tools_before = dict(tool_registry._registry)
    handlers_before = dict(tool_registry._handlers)
    tool_names_before = set(tool_registry._registry.keys())

    result = ScenarioRunner.run("S1")
    assert result.passed is True

    # Operational registry keys and handlers must be preserved exactly
    assert set(tool_registry._registry.keys()) == tool_names_before
    for name, tool_def in tools_before.items():
        assert tool_registry.get_tool(name) == tool_def
        assert tool_registry._handlers[name] is handlers_before[name]


# =============================================================================
# TEST 2 — Registry restored after benchmark exception
# =============================================================================

def test_registry_restored_after_benchmark_exception():
    """TEST 2: Operational registry state must be restored even if benchmark raises an exception."""
    tools_before = dict(tool_registry._registry)
    handlers_before = dict(tool_registry._handlers)
    tool_names_before = set(tool_registry._registry.keys())

    with patch("backend.app.scenarios.runner.run_orca_graph", side_effect=RuntimeError("Simulated Benchmark Graph Crash")):
        with pytest.raises(RuntimeError, match="Simulated Benchmark Graph Crash"):
            ScenarioRunner.run("S1")

    # Registry must be completely restored despite the unhandled exception
    assert set(tool_registry._registry.keys()) == tool_names_before
    for name, tool_def in tools_before.items():
        assert tool_registry.get_tool(name) == tool_def
        assert tool_registry._handlers[name] is handlers_before[name]


# =============================================================================
# TEST 3 — Memory store restored after successful benchmark
# =============================================================================

def test_memory_store_restored_after_successful_benchmark():
    """TEST 3: Operational memory store must be preserved and restored after successful benchmark."""
    custom_store = InMemoryConversationStore()
    custom_thread = ThreadContext(
        thread_id="operational-session-42",
        active_harbor="Cochin",
        active_craft_profile="inboard_trawler",
    )
    custom_store.save_thread(custom_thread)

    orig_store = memory_manager.store
    try:
        memory_manager.set_store(custom_store)

        result = ScenarioRunner.run("S1")
        assert result.passed is True

        assert memory_manager.store is custom_store
        persisted = memory_manager.load_context("operational-session-42")
        assert persisted.active_harbor == "Cochin"
        assert persisted.active_craft_profile == "inboard_trawler"
    finally:
        memory_manager.set_store(orig_store)


# =============================================================================
# TEST 4 — Memory store restored after benchmark exception
# =============================================================================

def test_memory_store_restored_after_benchmark_exception():
    """TEST 4: Operational memory store must be restored even if benchmark raises an exception."""
    custom_store = InMemoryConversationStore()
    custom_thread = ThreadContext(
        thread_id="operational-session-fail-test",
        active_harbor="Goa",
    )
    custom_store.save_thread(custom_thread)

    orig_store = memory_manager.store
    try:
        memory_manager.set_store(custom_store)

        with patch("backend.app.scenarios.runner.run_orca_graph", side_effect=ValueError("Forced Scenario Crash")):
            with pytest.raises(ValueError, match="Forced Scenario Crash"):
                ScenarioRunner.run("S1")

        assert memory_manager.store is custom_store
        persisted = memory_manager.load_context("operational-session-fail-test")
        assert persisted.active_harbor == "Goa"
    finally:
        memory_manager.set_store(orig_store)


# =============================================================================
# TEST 5 — Scenario mock does not leak into normal execution
# =============================================================================

def test_scenario_mock_does_not_leak_into_normal_execution():
    """TEST 5: Scenario-specific mock tool handlers must not leak into operational registry."""
    orig_handler = tool_registry._handlers.get("marine_conditions")
    assert orig_handler is not None, "Operational marine_conditions handler must be present"

    # Run S3 (which configures ScenarioMarineProvider with severe cyclone inputs)
    result = ScenarioRunner.run("S3")
    assert result.passed is True

    current_handler = tool_registry._handlers.get("marine_conditions")
    assert current_handler is orig_handler, "Operational handler must be identical to pre-benchmark handler"
    if hasattr(current_handler, "__self__"):
        assert not isinstance(current_handler.__self__, ScenarioMarineProvider)


# =============================================================================
# TEST 6 — Existing benchmark behavior still passes
# =============================================================================

def test_existing_benchmark_behavior_still_passes():
    """TEST 6: Canonical benchmark scenarios S1-S8 all execute and pass under isolated runner."""
    for sid in ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]:
        result = ScenarioRunner.run(sid)
        assert result.passed is True, f"Scenario {sid} failed: {result.validation_notes}"


# =============================================================================
# TEST 7 — Multiple sequential benchmarks
# =============================================================================

def test_multiple_sequential_benchmarks():
    """TEST 7: Running sequential benchmarks (S1, S2, S3) preserves operational state throughout."""
    tools_before = dict(tool_registry._registry)
    handlers_before = dict(tool_registry._handlers)
    orig_store = memory_manager.store

    for sid in ["S1", "S2", "S3"]:
        res = ScenarioRunner.run(sid)
        assert res.passed is True

    assert set(tool_registry._registry.keys()) == set(tools_before.keys())
    for name, tool_def in tools_before.items():
        assert tool_registry.get_tool(name) == tool_def
        assert tool_registry._handlers[name] is handlers_before[name]
    assert memory_manager.store is orig_store


# =============================================================================
# TEST 8 — Operational chat after benchmark (Regression Test for Actual Bug)
# =============================================================================

def test_operational_chat_after_benchmark_regression(client: TestClient):
    """TEST 8: Real failure mode regression test.

    Before fix:
        Running S3 (severe cyclone NO_GO) wiped operational tools and left
        ScenarioMarineProvider installed.
        A subsequent /chat request for a calm harbor would be evaluated against
        S3's 7.5m cyclone waves and return NO_GO.

    After fix:
        Operational tools are restored after S3 completes.
        A subsequent /chat request executes against operational tools and returns
        normal operational results, uncorrupted by S3's mock conditions.
    """
    # 1. Capture operational marine handler
    operational_marine_handler = tool_registry._handlers.get("marine_conditions")
    assert operational_marine_handler is not None

    # 2. Run benchmark S3 (cyclone NO_GO)
    bench_resp = client.post("/api/v1/scenarios/S3/run")
    assert bench_resp.status_code == 200
    assert bench_resp.json()["passed"] is True
    assert bench_resp.json()["actual_status"] == "NO_GO"

    # 3. Verify operational tools were restored immediately after benchmark finishes
    assert tool_registry._handlers.get("marine_conditions") is operational_marine_handler
    if hasattr(operational_marine_handler, "__self__"):
        assert not isinstance(operational_marine_handler.__self__, ScenarioMarineProvider)

    # 4. Post a normal operational chat request
    chat_resp = client.post("/api/v1/chat", json={
        "message": "Is it safe to leave Ratnagiri tomorrow morning?",
        "user_context": {
            "origin_harbor": "Ratnagiri",
            "craft_profile": "motorized_boat",
            "language_preference": "en",
        },
    })
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()

    # Evidence must NOT contain scenario-bound cyclone values
    for ev in chat_data.get("evidence", []):
        source = ev.get("source", "")
        # ScenarioMarineProvider tags its source as "INCOIS OSF (Scenario Bound)"
        assert "(Scenario Bound)" not in source, (
            f"Leaked scenario mock provider detected in operational chat evidence: {source}"
        )
