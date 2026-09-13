"""P0-7 Authority chat request-scoped sector context tests."""

import pytest
from fastapi import HTTPException

from backend.app.agents.graph import intent_locale_node, specialist_tools_node
from backend.app.agents.memory import InMemoryConversationStore, memory_manager
from backend.app.agents.tools import tool_registry
from backend.app.api.v1.routes import _build_user_context
from backend.app.contracts.chat import ChatRequest, UserContext
from backend.app.domain.situation import resolve_authority_sector_context


@pytest.mark.parametrize(
    ("sector_id", "harbor", "coordinates"),
    [
        ("sector-ratnagiri", "Ratnagiri", [73.28, 16.99]),
        ("sector-goa", "Panaji", [73.83, 15.49]),
        ("sector-mumbai", "Mumbai", [72.87, 18.92]),
    ],
)
def test_authority_sector_id_resolves_to_canonical_request_context(
    sector_id: str, harbor: str, coordinates: list[float]
):
    context = _build_user_context(
        ChatRequest(
            message="What is happening in this sector?",
            user_context=UserContext(
                sector_id=sector_id,
                # Must not be trusted when a canonical Authority sector is supplied.
                origin_harbor="Ratnagiri",
                coordinates=[73.28, 16.99],
            ),
        )
    )

    assert context["sector_id"] == sector_id
    assert context["origin_harbor"] == harbor
    assert context["coordinates"] == coordinates


def test_invalid_authority_sector_is_rejected_without_defaulting():
    with pytest.raises(HTTPException) as exc_info:
        _build_user_context(
            ChatRequest(
                message="Why is this sector safe?",
                user_context=UserContext(sector_id="Ratnagiri Sector (MH-03)"),
            )
        )

    assert exc_info.value.status_code == 422


def test_sequential_authority_requests_do_not_leak_sector_context():
    memory_manager.set_store(InMemoryConversationStore())
    conversation_id = "p0-7-sector-switch"

    first_context = _build_user_context(
        ChatRequest(message="Why is this sector safe?", user_context=UserContext(sector_id="sector-ratnagiri"))
    )
    first_state = intent_locale_node(
        {"thread_id": conversation_id, "user_message": "Why is this sector safe?", "user_profile": first_context}
    )

    second_context = _build_user_context(
        ChatRequest(message="Why is this sector safe?", user_context=UserContext(sector_id="sector-goa"))
    )
    second_state = intent_locale_node(
        {"thread_id": conversation_id, "user_message": "Why is this sector safe?", "user_profile": second_context}
    )

    assert first_state["origin_harbor"] == "Ratnagiri"
    assert second_state["origin_harbor"] == "Panaji"
    assert second_state["location"]["coordinates"] == [73.83, 15.49]


def test_authority_sector_resolver_requires_canonical_public_id():
    assert resolve_authority_sector_context("sector-goa")["origin_harbor"] == "Panaji"
    assert resolve_authority_sector_context("Goa Naval Corridor (GA-01)") is None


def test_sector_context_reaches_specialist_tool_invocation():
    initial_history_length = len(tool_registry.execution_history)
    specialist_tools_node(
        {
            "task_plan": ["marine_conditions"],
            "origin_harbor": "Panaji",
            "location": {"harbor": "Panaji", "coordinates": [73.83, 15.49]},
            "user_profile": {"craft_profile": "motorized_boat", "sector_id": "sector-goa"},
            "tool_results": {},
            "observations": {},
            "evidence": [],
            "warnings": [],
            "trace": [],
        }
    )

    invocation = tool_registry.execution_history[initial_history_length]
    assert invocation.input_params["origin_harbor"] == "Panaji"
    assert invocation.input_params["sector_id"] == "sector-goa"
