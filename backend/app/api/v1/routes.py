"""API v1 Routing for SAMUDRA.

Owned by Dev 2 (Backend Platform).
Routes declare types and inputs, delegating to:
  - AgentRunService  (Dev 2): async wrapper around Dev 3's run_orca_graph
  - map_state_to_response (Dev 2): ORCAState → ChatResponse conversion

Dev 2 responsibilities here:
- Request validation and session ID generation
- DATA_MODE-aware tool_mode selection (via AgentRunService)
- LIVE/HYBRID rejection until providers are wired (returns 503)
- Bounded error handling (no agent errors exposed to client)
- OpenAPI request/response examples for developer discovery
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from backend.app.contracts.chat import (
    ChatRequest,
    ChatResponse,
)
from backend.app.core.config import settings
from backend.app.services.agent_run_service import (
    AgentRunService,
    Dev2ErrorEnvelope,
    _AgentRuntimeUnavailableError,
    _LiveModeNotReadyError,
    agent_run_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_user_context(request: ChatRequest) -> Dict[str, Any]:
    """Convert ChatRequest.user_context to the dict expected by ORCAState."""
    if request.user_context is None:
        return {}
    ctx = request.user_context
    return {
        "origin_harbor": ctx.origin_harbor,
        "coordinates": ctx.coordinates,
        "craft_profile": ctx.craft_profile or "motorized_boat",
        "language_preference": ctx.language_preference or "auto",
    }


# ---------------------------------------------------------------------------
# OpenAPI examples — used on the /chat endpoint
# ---------------------------------------------------------------------------

_CHAT_REQUEST_EXAMPLE: Dict[str, Any] = {
    "summary": "Safety check from Ratnagiri (SNAPSHOT mode)",
    "description": (
        "Typical safety-of-departure query in English. "
        "In SNAPSHOT mode the response is populated from M2 contract mocks."
    ),
    "value": {
        "message": "Is it safe to leave Ratnagiri tomorrow morning?",
        "conversation_id": None,
        "user_context": {
            "origin_harbor": "Ratnagiri",
            "craft_profile": "motorized_boat",
            "language_preference": "en",
        },
    },
}

_CHAT_REQUEST_EXAMPLE_HINDI: Dict[str, Any] = {
    "summary": "Hindi safety query (multi-lingual)",
    "value": {
        "message": "क्या कल सुबह रत्नागिरि से निकलना सुरक्षित है?",
        "user_context": {
            "origin_harbor": "Ratnagiri",
            "craft_profile": "motorized_boat",
            "language_preference": "hi",
        },
    },
}

_CHAT_RESPONSE_EXAMPLE: Dict[str, Any] = {
    "summary": "Successful CAUTION response (SNAPSHOT / contract-mock)",
    "value": {
        "run_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "conversation_id": "8d1e5c0f-2b4a-4e6b-9f7c-1a3d5e7b9f01",
        "language": "en",
        "intent": "GO_NO_GO_SAFETY",
        "answer": "[CAUTION] Operational Advisory for Ratnagiri: ...",
        "recommendation": {
            "status": "CAUTION",
            "summary": "Elevated wave heights forecast. Exercise caution.",
            "decisive_factors": ["Significant wave height: 2.1 m", "Wind speed: 18 kn"],
            "next_action": "Depart only with experienced crew and adequate safety gear.",
        },
        "confidence": {
            "level": "MEDIUM",
            "reasons": ["INCOIS OSF data (contract mock). Real-time verification pending."],
        },
        "evidence": [],
        "map_layers": [],
        "trace": [],
        "warnings": ["[SNAPSHOT] Data sourced from M2 contract mocks — not live."],
        "suggested_followups": [
            "When will sea conditions improve?",
            "Alternative sheltered route options",
            "Port authority emergency contacts",
        ],
    },
}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/health", tags=["System"])
async def health_check():
    """System health check and operational mode discovery."""
    from backend.app.db.session import SessionLocal
    from sqlalchemy import text
    
    db_status = "unknown"
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception as e:
        db_status = f"disconnected ({e})"

    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "app_env": settings.APP_ENV,
        "data_mode": settings.DATA_MODE,
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    tags=["Agentic Chat"],
    summary="Submit query to LangGraph Bounded Agent Pipeline",
    description=(
        "Entrypoint for marine natural-language queries.\n\n"
        "Wires ChatRequest into the LangGraph ORCA agent pipeline (Dev 3) and\n"
        "converts the resulting ORCAState into a ChatResponse.\n\n"
        "**DATA_MODE behaviour:**\n"
        "- `SNAPSHOT` — Uses M2 typed contract mocks (`tool_mode=contract_mock`). "
        "All evidence items are explicitly labelled as simulated. "
        "This is the only mode enabled in the current milestone.\n"
        "- `LIVE` / `HYBRID` — Returns **503** until real provider auth and "
        "connector wiring are completed (Dev 3 handoff).\n\n"
        "**Error handling:**\n"
        "- Agent graph exceptions are caught and returned as a ChatResponse "
        "with `recommendation.status=UNKNOWN` and a `[DEV2-AGENT-ERROR]` warning.\n"
        "- Missing langgraph dependency → HTTP 503 with structured error body."
    ),
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "examples": {
                        "safety_en": _CHAT_REQUEST_EXAMPLE,
                        "safety_hi": _CHAT_REQUEST_EXAMPLE_HINDI,
                    }
                }
            }
        },
        "responses": {
            "200": {
                "content": {
                    "application/json": {
                        "examples": {
                            "caution_snapshot": _CHAT_RESPONSE_EXAMPLE,
                        }
                    }
                }
            }
        },
    },
)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Entrypoint for marine natural-language queries.

    Delegates to AgentRunService which:
    1. Guards DATA_MODE (rejects LIVE/HYBRID with 503)
    2. Offloads synchronous run_orca_graph to anyio's thread pool
    3. Maps ORCAState → ChatResponse via state_mapper
    4. Returns a degraded UNKNOWN response on agent exception

    Session management
    ------------------
    - ``conversation_id`` is generated server-side if absent from the request.
    - A new ``run_id`` UUID is generated for every request regardless.
    """
    conversation_id = request.conversation_id or str(uuid.uuid4())
    run_id = str(uuid.uuid4())
    user_context = _build_user_context(request)

    try:
        return await agent_run_service.run_snapshot(
            user_message=request.message,
            conversation_id=conversation_id,
            run_id=run_id,
            user_context=user_context,
        )

    except _LiveModeNotReadyError as exc:
        envelope = Dev2ErrorEnvelope(
            code="DATA_MODE_NOT_READY",
            message=(
                f"DATA_MODE={exc.data_mode} is not yet available. "
                "Only SNAPSHOT mode is enabled in this milestone."
            ),
            hint=(
                "Set DATA_MODE=SNAPSHOT in your environment, or wait for the "
                "provider wiring milestone (Dev 3 handoff)."
            ),
            run_id=exc.run_id,
        )
        logger.warning(
            "chat: DATA_MODE=%s not ready — run_id=%s", exc.data_mode, exc.run_id
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=envelope.to_dict(),
        )

    except _AgentRuntimeUnavailableError as exc:
        envelope = Dev2ErrorEnvelope(
            code="AGENT_RUNTIME_UNAVAILABLE",
            message="Agent runtime is not available. Ensure all dependencies are installed.",
            hint="Install: pip install langgraph",
            run_id=exc.run_id,
        )
        logger.error("chat: langgraph unavailable — run_id=%s", exc.run_id)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=envelope.to_dict(),
        )


@router.get(
    "/scenarios",
    tags=["Evaluation & Demo"],
    summary="List canonical evaluation scenarios (S1–S8)",
)
async def list_scenarios():
    """Returns metadata for the 8 canonical evaluation scenarios (S1-S8)."""
    return {
        "scenarios": [
            {"id": "S1", "name": "Normal conditions", "intent": "GO_NO_GO_SAFETY"},
            {"id": "S2", "name": "Elevated sea state", "intent": "GO_NO_GO_SAFETY"},
            {"id": "S3", "name": "Severe marine/cyclone warning", "intent": "GO_NO_GO_SAFETY"},
            {"id": "S4", "name": "Missing/stale critical forecast", "intent": "GO_NO_GO_SAFETY"},
            {"id": "S5", "name": "Nearest PFZ", "intent": "NEAREST_PFZ"},
            {"id": "S6", "name": "Route crosses restricted polygon", "intent": "HAZARD_BOUNDARY"},
            {"id": "S7", "name": "Safer alternative route", "intent": "SAFER_ROUTE"},
            {"id": "S8", "name": "Hindi/Marathi multi-turn follow-up", "intent": "MULTI_TURN"},
        ]
    }


@router.get(
    "/demo-scenarios",
    tags=["Evaluation & Demo"],
    summary="Canonical alias for /scenarios — list evaluation scenarios (S1–S8)",
    description=(
        "Canonical alias for ``GET /api/v1/scenarios``.\n\n"
        "Returns the same 8 evaluation scenario descriptors. "
        "Clients and demo frontends should prefer this path going forward."
    ),
)
async def list_demo_scenarios():
    """Canonical alias for /scenarios — returns the same 8 scenario descriptors."""
    return await list_scenarios()
