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
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from backend.app.contracts.chat import (
    ChatRequest,
    ChatResponse,
)
from backend.app.core.config import settings
from backend.app.services.agent_run_service import (
    Dev2ErrorEnvelope,
    _AgentExecutionError,
    _AgentRuntimeUnavailableError,
    _DuplicateRunError,
    _LiveModeNotReadyError,
    agent_run_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_user_context(request: ChatRequest) -> dict[str, Any]:
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

_CHAT_REQUEST_EXAMPLE: dict[str, Any] = {
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

_CHAT_REQUEST_EXAMPLE_HINDI: dict[str, Any] = {
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

_CHAT_RESPONSE_EXAMPLE: dict[str, Any] = {
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
    from sqlalchemy import text

    from backend.app.db.models import ConnectorStatus
    from backend.app.db.session import SessionLocal
    
    db_status = "unknown"
    global_status = "healthy"
    
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
            db_status = "connected"
            
            # Check connector health
            connectors = session.query(ConnectorStatus).all()
            if any(not c.is_online for c in connectors):
                global_status = "degraded"
                
    except Exception as e:
        db_status = f"disconnected ({e})"
        global_status = "unavailable"

    # If DB is up, but ALL live connectors we track are down, we might be unavailable or degraded.
    # In SNAPSHOT mode, we are always healthy if DB is connected.
    if settings.DATA_MODE != "SNAPSHOT" and db_status == "connected":
        if connectors and all(not c.is_online for c in connectors):
            global_status = "unavailable"

    return {
        "status": global_status,
        "app_name": settings.APP_NAME,
        "app_env": settings.APP_ENV,
        "data_mode": settings.DATA_MODE,
        "database": db_status,
        "timestamp": datetime.now(UTC).isoformat(),
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
        return await agent_run_service.run_agent(
            user_message=request.message,
            conversation_id=conversation_id,
            run_id=run_id,
            user_context=user_context,
        )

    except _DuplicateRunError as exc:
        envelope = Dev2ErrorEnvelope(
            code="DUPLICATE_RUN",
            message=f"Run ID {exc.run_id} already exists.",
            hint="Generate a new UUID for each chat request.",
            run_id=exc.run_id,
        )
        logger.warning("chat: Duplicate run — run_id=%s", exc.run_id)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=envelope.to_dict(),
        )

    except _AgentExecutionError as exc:
        from backend.app.connectors.errors import (
            ConnectorAuthenticationError,
            ConnectorMalformedResponseError,
            ConnectorRateLimitError,
            ConnectorTimeoutError,
            ConnectorUpstreamUnavailableError,
        )

        error_code = "AGENT_EXECUTION_FAILED"
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        msg = "SAMUDRA encountered an internal error while processing your query."
        
        # Mask raw error messages for public consumption
        if isinstance(exc.original_exc, ConnectorTimeoutError):
            error_code = "UPSTREAM_TIMEOUT"
            status_code = status.HTTP_504_GATEWAY_TIMEOUT
            msg = "A live marine data provider took too long to respond."
        elif isinstance(exc.original_exc, ConnectorRateLimitError):
            error_code = "UPSTREAM_RATE_LIMIT"
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
            msg = "Too many requests to marine data providers. Please try again later."
        elif isinstance(exc.original_exc, ConnectorAuthenticationError):
            error_code = "UPSTREAM_AUTH_FAILED"
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            msg = "SAMUDRA is temporarily unable to authenticate with marine data providers."
        elif isinstance(exc.original_exc, ConnectorMalformedResponseError):
            error_code = "UPSTREAM_MALFORMED_DATA"
            status_code = status.HTTP_502_BAD_GATEWAY
            msg = "Received invalid or unparseable data from a marine data provider."
        elif isinstance(exc.original_exc, ConnectorUpstreamUnavailableError):
            error_code = "UPSTREAM_UNAVAILABLE"
            status_code = status.HTTP_502_BAD_GATEWAY
            msg = "A critical marine data provider is currently offline or unreachable."
            
        envelope = Dev2ErrorEnvelope(
            code=error_code,
            message=msg,
            hint="Please try again or contact support. Do not make any voyage decisions based on this response.",
            run_id=exc.run_id,
        )
        logger.error("chat: Agent execution failed — run_id=%s: %s", exc.run_id, exc.original_exc)
        return JSONResponse(
            status_code=status_code,
            content=envelope.to_dict(),
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
    "/runs/{run_id}",
    tags=["Agentic Chat"],
    summary="Get Run details",
)
async def get_run(run_id: str):
    """Retrieve details for a specific ORCA agent run."""
    import uuid

    from backend.app.db.repositories import RunRepository
    from backend.app.db.session import SessionLocal
    
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid run_id format"})

    with SessionLocal() as session:
        run = RunRepository(session).get_by_id(run_uuid)
        if not run:
            return JSONResponse(status_code=404, content={"error": "Run not found"})
        
        return {
            "id": str(run.id),
            "thread_id": run.thread_id,
            "status": run.run_status.value,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "error_message": run.error_message,
        }


@router.get(
    "/map/layers/{layer_id}",
    tags=["Map"],
    summary="Get Map Layer",
)
async def get_map_layer(layer_id: str):
    """Retrieve a specific Map Layer by ID."""
    import uuid

    from geoalchemy2.shape import to_shape
    from shapely.geometry import mapping

    from backend.app.db.models import MapLayer
    from backend.app.db.session import SessionLocal
    
    try:
        layer_uuid = uuid.UUID(layer_id)
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid layer_id format"})

    with SessionLocal() as session:
        layer = session.query(MapLayer).filter_by(id=layer_uuid).first()
        if not layer:
            return JSONResponse(status_code=404, content={"error": "Map layer not found"})
            
        geom_shape = to_shape(layer.geometry)
        geojson_geom = mapping(geom_shape)
        
        return {
            "id": str(layer.id),
            "run_id": str(layer.run_id),
            "layer_type": layer.layer_type,
            "geometry": geojson_geom,
            "properties": layer.properties,
            "created_at": layer.created_at.isoformat() if layer.created_at else None,
        }


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


@router.get(
    "/chat/{conversation_id}/history",
    tags=["Agentic Chat"],
    summary="Get conversation history",
)
async def get_conversation_history(conversation_id: str):
    """Retrieve chat history for a specific conversation ID."""
    from backend.app.db.repositories import RunRepository
    from backend.app.db.session import SessionLocal
    
    with SessionLocal() as session:
        runs = RunRepository(session).get_all_by_thread(conversation_id)
        if not runs:
            return JSONResponse(status_code=404, content={"error": "Conversation not found"})
        
        history = []
        for run in runs:
            history.append({
                "id": str(run.id),
                "status": run.run_status.value,
                "started_at": run.started_at.isoformat() if run.started_at else None,
            })
        return {"conversation_id": conversation_id, "history": history}


@router.get(
    "/layers/base",
    tags=["Map"],
    summary="Get static base layers",
)
async def get_base_layers():
    """Returns static operational polygons (e.g. IMBL, restricted zones) as GeoJSON."""
    import json
    from pathlib import Path
    
    # We can load these from data/fixtures/geospatial/ or similar if they exist.
    # For prototype, if not available, return empty feature collection.
    base_file = Path("data/fixtures/geospatial/restricted_zones.geojson")
    if base_file.exists():
        try:
            with open(base_file, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
            
    return {"type": "FeatureCollection", "features": []}
