"""Agent Run Service — Non-blocking ORCA Graph Dispatcher.

Owned by Dev 2 (Backend Platform).
Referenced by: backend/app/api/v1/routes.py

This service is the sole point of contact between the FastAPI async layer
(Dev 2) and the synchronous LangGraph orchestrator (Dev 3).

Design decisions
----------------

1. Why ``anyio.to_thread.run_sync``?
   ``run_orca_graph`` calls ``graph.invoke()`` which is *synchronous* —
   LangGraph's StateGraph compile/invoke API does not expose an async
   interface at M1.  Calling it directly on the asyncio event loop would
   block every other in-flight request for the full graph execution duration
   (typically 300 ms–2 s under demo/mock modes).  Offloading to anyio's
   thread pool gives us cooperative concurrency at no correctness cost and
   no change to the Dev 3 interface.

2. Why ``tool_mode="contract_mock"`` for SNAPSHOT?
   The original "demo" tool_mode was the M1 stub layer — hard-wired fixture
   values with no typing guarantees.  The M2 contract mock layer
   (``tool_mode="contract_mock"``) provides typed Pydantic-validated
   payloads that exactly mirror the contracts that live providers will
   satisfy in a future milestone.  Using contract mocks for SNAPSHOT means
   the API surface exercised in snapshot mode is *identical* to the one that
   will be exercised in LIVE mode — only the data source changes.

   IMPORTANT: Contract mocks are labelled as simulated data in every
   EvidenceItem.quality_flags list.  They must NEVER be treated as live
   or hybrid data.

3. Why LIVE/HYBRID return 503?
   Real provider authentication (INCOIS API keys, IMD tokens) and connector
   wiring belong to a future milestone.  Exposing LIVE or HYBRID silently
   while still serving contract mocks would be a safety lie — a mariner
   would receive data that looks authoritative but is fabricated.  503 with
   a clear human-readable body is the only honest response until Dev 3
   completes the provider handoff.

4. Dev 3 handoff for provider mode
   When real providers are integrated, Dev 3 should:
   a. Add ``register_live_providers(tool_registry)`` in ``graph.py`` or a
      new ``integrations/live.py`` module.
   b. Update ``run_orca_graph`` to accept and route a ``tool_mode="live"``
      value through the supervisor node.
   c. Signal readiness by removing the LIVE/HYBRID guard below (or
      replacing it with a feature-flag check on ``settings.LIVE_READY``).
   Dev 2 will then wire ``AgentRunService.run_live()`` without touching the
   SNAPSHOT path.

5. Agent exception → degraded ChatResponse (not 5xx)
   A 500 on a marine safety query is worse UX than an explicit UNKNOWN
   response that tells the mariner "hold departure and contact support".
   The route layer can distinguish degraded responses via the warning
   ``"[DEV2-AGENT-ERROR]"`` prefix in the warnings list.
"""

from __future__ import annotations

import logging
import uuid
from functools import partial
from typing import Any, Dict, Optional

import anyio

from backend.app.contracts.chat import (
    ChatResponse,
    Confidence,
    ConfidenceLevel,
    Recommendation,
    RecommendationStatus,
)
from backend.app.core.config import settings
from backend.app.services.state_mapper import map_state_to_response

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Structured Dev 2 error envelope (also importable by the route layer)
# ---------------------------------------------------------------------------

class Dev2ErrorEnvelope:
    """Structured error body returned when the agent service cannot proceed.

    Not a Pydantic model — kept as a plain dataclass-style class so it can
    be used as both a dict payload and as a typed container without
    introducing a full model into the contract layer.
    """

    def __init__(
        self,
        code: str,
        message: str,
        hint: str = "",
        run_id: Optional[str] = None,
    ) -> None:
        self.code = code
        self.message = message
        self.hint = hint
        self.run_id = run_id or str(uuid.uuid4())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "hint": self.hint,
                "run_id": self.run_id,
            }
        }


# ---------------------------------------------------------------------------
# Degraded ChatResponse builder (agent exception path)
# ---------------------------------------------------------------------------

def _build_degraded_response(
    run_id: str,
    conversation_id: str,
    exc: Exception,
) -> ChatResponse:
    """Return a conservative UNKNOWN ChatResponse when the graph crashes.

    The warning list is tagged with ``[DEV2-AGENT-ERROR]`` so the route
    layer can log/alert without leaking exception internals to the client.
    """
    exc_type = type(exc).__name__
    logger.exception("AgentRunService: graph execution failed (%s)", exc_type)
    return ChatResponse(
        run_id=run_id,
        conversation_id=conversation_id,
        language="en",
        intent="UNKNOWN",
        answer=(
            "SAMUDRA encountered an internal error while processing your query. "
            "Please try again or contact support. "
            "Do not make any voyage decisions based on this response."
        ),
        recommendation=Recommendation(
            status=RecommendationStatus.UNKNOWN,
            summary="System error: risk evaluation could not be completed.",
            decisive_factors=["Internal agent error — no reliable data available."],
            next_action="Hold departure. Do not rely on this response.",
        ),
        confidence=Confidence(
            level=ConfidenceLevel.LOW,
            reasons=["Agent execution failed — no reliable data was gathered."],
        ),
        evidence=[],
        map_layers=[],
        trace=[],
        warnings=[
            f"[DEV2-AGENT-ERROR] Agent runtime error ({exc_type}). "
            "Response is unreliable and must not be used for voyage decisions."
        ],
        suggested_followups=[],
    )


# ---------------------------------------------------------------------------
# Main service
# ---------------------------------------------------------------------------

class AgentRunService:
    """DATA_MODE-aware dispatcher for the ORCA LangGraph pipeline.

    Instantiate once at application startup and inject into route handlers.

    Methods
    -------
    run_snapshot : async
        Execute the graph in SNAPSHOT mode using M2 contract mocks.
    """

    def __init__(self, data_mode: Optional[str] = None) -> None:
        self._data_mode = data_mode or settings.DATA_MODE

    # ------------------------------------------------------------------
    # SNAPSHOT mode — the only production-ready path in this milestone
    # ------------------------------------------------------------------

    async def run_snapshot(
        self,
        *,
        user_message: str,
        conversation_id: str,
        run_id: str,
        user_context: Optional[Dict[str, Any]] = None,
    ) -> ChatResponse:
        """Run the ORCA graph in SNAPSHOT / contract-mock mode.

        Offloads the synchronous ``run_orca_graph`` call to anyio's default
        thread pool so the asyncio event loop is never blocked.

        Parameters
        ----------
        user_message:
            Raw natural-language query from the client.
        conversation_id:
            Session UUID (from client or generated server-side).
        run_id:
            Unique per-request UUID for telemetry.
        user_context:
            Optional dict built from ``ChatRequest.user_context``.

        Returns
        -------
        ChatResponse
            Schema-valid response; always a ChatResponse — never raises.
        """
        # ------------------------------------------------------------------
        # DATA_MODE guard — LIVE not yet ready, HYBRID falls back to snapshot
        # ------------------------------------------------------------------
        if self._data_mode == "LIVE":
            logger.warning(
                "AgentRunService: DATA_MODE=%s requested but LIVE providers "
                "are not yet implemented. Returning 503.",
                self._data_mode,
            )
            # Caller must convert this into an HTTP 503 response.
            raise _LiveModeNotReadyError(
                data_mode=self._data_mode,
                run_id=run_id,
            )

        # ------------------------------------------------------------------
        # Import guard — langgraph may not be installed in all environments
        # ------------------------------------------------------------------
        try:
            from backend.app.agents.graph import run_orca_graph  # Dev 3 owned
        except ImportError as exc:
            logger.error(
                "AgentRunService: langgraph not installed — run_orca_graph unavailable: %s",
                exc,
            )
            raise _AgentRuntimeUnavailableError(run_id=run_id) from exc

        # ------------------------------------------------------------------
        # Offload synchronous graph execution to thread pool
        # ------------------------------------------------------------------
        logger.info(
            "AgentRunService: run_id=%s conversation_id=%s data_mode=%s tool_mode=contract_mock",
            run_id,
            conversation_id,
            self._data_mode,
        )

        _run = partial(
            run_orca_graph,
            user_message=user_message,
            thread_id=conversation_id,
            user_context=user_context or {},
            tool_mode="contract_mock",   # M2 typed contract mocks for SNAPSHOT
            llm_mode="deterministic",    # No LLM provider key required
        )

        try:
            final_state = await anyio.to_thread.run_sync(_run)
        except Exception as exc:
            return _build_degraded_response(run_id, conversation_id, exc)

        return map_state_to_response(final_state, run_id, conversation_id)


# ---------------------------------------------------------------------------
# Internal sentinel exceptions (never surfaced to clients)
# ---------------------------------------------------------------------------

class _LiveModeNotReadyError(Exception):
    """Raised when DATA_MODE is LIVE or HYBRID before providers are wired."""

    def __init__(self, data_mode: str, run_id: str) -> None:
        self.data_mode = data_mode
        self.run_id = run_id
        super().__init__(f"DATA_MODE={data_mode} not yet implemented")


class _AgentRuntimeUnavailableError(Exception):
    """Raised when the langgraph package cannot be imported."""

    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        super().__init__("langgraph not installed")


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

agent_run_service = AgentRunService()
