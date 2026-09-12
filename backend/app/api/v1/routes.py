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

from fastapi import APIRouter, File, Form, UploadFile, status
from fastapi.responses import JSONResponse

from backend.app.contracts.chat import (
    ChatRequest,
    ChatResponse,
    TranscribeResponse,
    VoiceChatResponse,
)
from backend.app.core.config import settings
from backend.app.db.session import SessionLocal
from backend.app.services.agent_run_service import (
    Dev2ErrorEnvelope,
    _AgentExecutionError,
    _AgentRuntimeUnavailableError,
    _DuplicateRunError,
    _LiveModeNotReadyError,
    agent_run_service,
)
from backend.app.services.stt_service import (
    STTConfigurationError,
    STTServiceError,
    transcribe_audio_bytes,
)
from backend.app.services.tts_service import (
    TTSConfigurationError,
    TTSServiceError,
    synthesize_speech,
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

    db_status = "unknown"
    global_status = "healthy"
    connectors = []

    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
            db_status = "connected"

            # Check connector health
            if settings.DATA_MODE != "SNAPSHOT":
                connectors = session.query(ConnectorStatus).all()
                if any(not c.is_online for c in connectors):
                    global_status = "degraded"
                if connectors and all(not c.is_online for c in connectors):
                    global_status = "unavailable"

    except Exception as e:
        logger.debug("Database health check failed (service offline): %s", e)
        db_status = f"disconnected ({e})"
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
            ConnectorMissingSnapshotError,
            ConnectorRateLimitError,
            ConnectorStaleSnapshotError,
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
        elif isinstance(
            exc.original_exc,
            (
                ConnectorUpstreamUnavailableError,
                ConnectorMissingSnapshotError,
                ConnectorStaleSnapshotError,
            ),
        ):
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
        logger.warning("chat: DATA_MODE=%s not ready — run_id=%s", exc.data_mode, exc.run_id)
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
    from backend.app.scenarios.registry import get_scenario_manifest

    manifest = get_scenario_manifest()
    return {"scenarios": [item.model_dump() for item in manifest]}


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
    "/scenarios/{scenario_id}",
    tags=["Evaluation & Demo"],
    summary="Get detailed scenario definition",
)
async def get_scenario_details(scenario_id: str):
    """Retrieve full scenario definition, inputs, and expected outcomes."""
    from backend.app.scenarios.registry import get_scenario

    try:
        scenario = get_scenario(scenario_id)
        return scenario.model_dump()
    except KeyError:
        return JSONResponse(status_code=404, content={"error": f"Scenario '{scenario_id}' not found."})


@router.post(
    "/scenarios/{scenario_id}/run",
    tags=["Evaluation & Demo"],
    summary="Execute evaluation scenario through SAMUDRA pipeline",
)
async def run_scenario_endpoint(scenario_id: str, language: str | None = None):
    """Executes a scenario deterministically through the LangGraph pipeline and returns the evaluation audit."""
    from backend.app.scenarios.registry import get_scenario
    from backend.app.scenarios.runner import ScenarioRunner

    try:
        scenario = get_scenario(scenario_id)
    except KeyError:
        return JSONResponse(status_code=404, content={"error": f"Scenario '{scenario_id}' not found."})

    result = ScenarioRunner.run(scenario, language=language)
    return result.model_dump()


@router.get(
    "/chat/{conversation_id}/history",
    tags=["Agentic Chat"],
    summary="Get conversation history",
)
async def get_conversation_history(conversation_id: str):
    """Retrieve chat history for a specific conversation ID."""
    from backend.app.db.repositories import RunRepository

    with SessionLocal() as session:
        runs = RunRepository(session).get_all_by_thread(conversation_id)
        if not runs:
            return JSONResponse(status_code=404, content={"error": "Conversation not found"})

        history = []
        for run in runs:
            history.append(
                {
                    "id": str(run.id),
                    "status": run.run_status.value,
                    "started_at": run.started_at.isoformat() if run.started_at else None,
                }
            )
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

    candidate_paths = [
        Path("data/fixtures/geofences_india.geojson"),
        Path("data/fixtures/geospatial/restricted_zones.geojson"),
    ]
    for path in candidate_paths:
        if path.exists():
            try:
                with open(path, encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "POLY-NAV-GOA-01",
                "properties": {
                    "polygon_id": "POLY-NAV-GOA-01",
                    "name": "Naval Firing Range Foxtrot (Goa Sector)",
                    "polygon_type": "NAVAL_FIRING_RANGE",
                    "is_hard_restriction": True,
                    "restriction_level": "NO_GO",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [73.15, 15.30],
                            [73.35, 15.30],
                            [73.35, 15.55],
                            [73.15, 15.55],
                            [73.15, 15.30],
                        ]
                    ],
                },
            }
        ],
    }
 
 
@router.post(
    "/voice/transcribe",
    response_model=TranscribeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Voice & STT"],
    summary="Transcribe mariner audio to text using Sarvam STT",
    description=(
        "Accepts multipart audio recordings (wav/webm/mp4), transcribes them using "
        "Sarvam AI's saaras:v4 model, and returns the transcript, raw language code, "
        "and normalized ISO-639-1 language code (e.g., 'mr', 'hi', 'en')."
    ),
)
async def transcribe_voice_endpoint(file: UploadFile = File(...)):
    """Transcribes an uploaded audio file using Sarvam STT."""
    try:
        audio_bytes = await file.read()
        filename = file.filename or "audio.wav"
        content_type = file.content_type

        result = transcribe_audio_bytes(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=content_type,
        )

        return TranscribeResponse(
            transcript=result["transcript"],
            language=result["language"],
            normalized_language=result["normalized_language"],
        )
    except STTConfigurationError as exc:
        logger.warning("Voice transcription unconfigured: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "STT_UNCONFIGURED", "detail": exc.message},
        )
    except STTServiceError as exc:
        logger.error("Voice transcription service error: %s", exc)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "STT_ERROR", "detail": exc.message},
        )
    except Exception as exc:
        logger.exception("Unexpected error in voice transcription: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "TRANSCRIPTION_FAILED", "detail": "An internal error occurred during audio transcription."},
        )


@router.post(
    "/voice/chat",
    response_model=VoiceChatResponse,
    status_code=status.HTTP_200_OK,
    tags=["Voice & STT"],
    summary="End-to-end voice chat endpoint (STT -> ORCA Agent -> TTS)",
    description=(
        "Accepts mariner audio recording via multipart form data, transcribes it using Sarvam STT, "
        "routes the query through the LangGraph ORCA reasoning pipeline, synthesizes the localized "
        "advisory using Sarvam TTS, and returns a playable base64 audio response alongside full "
        "safety recommendation, evidence, and trace telemetry."
    ),
)
async def voice_chat_endpoint(
    file: UploadFile = File(...),
    conversation_id: str | None = Form(None),
    origin_harbor: str | None = Form(None),
    craft_profile: str | None = Form("motorized_boat"),
    language_preference: str | None = Form("auto"),
):
    """End-to-end voice chat adapter around ORCA pipeline."""
    # 1. Validate audio payload
    try:
        audio_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded audio file: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "INVALID_AUDIO", "detail": "Failed to read uploaded audio file."},
        )

    if not audio_bytes or len(audio_bytes) == 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "INVALID_AUDIO", "detail": "Empty audio file provided."},
        )

    # 2. STT Transcription
    filename = file.filename or "audio.wav"
    content_type = file.content_type

    try:
        stt_result = transcribe_audio_bytes(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=content_type,
        )
    except STTConfigurationError as exc:
        logger.warning("Voice chat STT unconfigured: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "STT_UNCONFIGURED", "detail": exc.message},
        )
    except STTServiceError as exc:
        logger.error("Voice chat STT error: %s", exc)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "STT_ERROR", "detail": exc.message},
        )
    except Exception as exc:
        logger.exception("Unexpected error in voice chat STT: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "TRANSCRIPTION_FAILED", "detail": "An internal error occurred during STT transcription."},
        )

    transcript = stt_result.get("transcript", "").strip()
    raw_language = stt_result.get("language", "unknown")
    normalized_language = stt_result.get("normalized_language", "en")

    if not transcript:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "EMPTY_TRANSCRIPT", "detail": "Could not recognize any speech in the uploaded audio."},
        )

    # 3. ORCA Agent Pipeline Integration
    effective_conv_id = conversation_id or str(uuid.uuid4())
    run_id = str(uuid.uuid4())

    effective_lang = (
        normalized_language
        if (language_preference in (None, "", "auto"))
        else language_preference
    )

    user_context = {
        "origin_harbor": origin_harbor,
        "craft_profile": craft_profile or "motorized_boat",
        "language_preference": effective_lang,
    }

    try:
        chat_response = await agent_run_service.run_agent(
            user_message=transcript,
            conversation_id=effective_conv_id,
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
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=envelope.to_dict(),
        )
    except _LiveModeNotReadyError as exc:
        envelope = Dev2ErrorEnvelope(
            code="DATA_MODE_NOT_READY",
            message=f"DATA_MODE={exc.data_mode} is not yet available.",
            hint="Set DATA_MODE=SNAPSHOT in your environment.",
            run_id=exc.run_id,
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=envelope.to_dict(),
        )
    except _AgentRuntimeUnavailableError as exc:
        envelope = Dev2ErrorEnvelope(
            code="AGENT_RUNTIME_UNAVAILABLE",
            message="Agent runtime is not available.",
            run_id=exc.run_id,
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=envelope.to_dict(),
        )
    except _AgentExecutionError as exc:
        envelope = Dev2ErrorEnvelope(
            code="AGENT_EXECUTION_FAILED",
            message="SAMUDRA encountered an internal error while processing your query.",
            run_id=exc.run_id,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=envelope.to_dict(),
        )
    except Exception as exc:
        logger.exception("Unexpected error in ORCA voice agent execution: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "AGENT_EXECUTION_FAILED", "detail": str(exc)},
        )

    if isinstance(chat_response, JSONResponse):
        return chat_response

    # 4. TTS Speech Synthesis
    audio_base64: str | None = None
    audio_format = "audio/wav"
    try:
        tts_result = synthesize_speech(
            text=chat_response.answer,
            language_code=chat_response.language or normalized_language,
        )
        audio_base64 = tts_result.get("audio_base64")
        audio_format = tts_result.get("audio_format", "audio/wav")
    except TTSConfigurationError as exc:
        logger.warning("Voice chat TTS unconfigured: %s", exc)
        chat_response.warnings.append(f"[TTS-UNCONFIGURED] Speech synthesis unavailable: {exc.message}")
    except TTSServiceError as exc:
        logger.error("Voice chat TTS service error: %s", exc)
        chat_response.warnings.append(f"[TTS-ERROR] Speech synthesis degraded: {exc.message}")
    except Exception as exc:
        logger.exception("Unexpected error in voice chat TTS: %s", exc)
        chat_response.warnings.append(f"[TTS-FAILED] Speech synthesis failed: {str(exc)}")

    # 5. Return Complete VoiceChatResponse
    return VoiceChatResponse(
        run_id=chat_response.run_id,
        conversation_id=chat_response.conversation_id,
        language=chat_response.language,
        intent=chat_response.intent,
        answer=chat_response.answer,
        recommendation=chat_response.recommendation,
        confidence=chat_response.confidence,
        evidence=chat_response.evidence,
        map_layers=chat_response.map_layers,
        trace=chat_response.trace,
        warnings=chat_response.warnings,
        suggested_followups=chat_response.suggested_followups,
        transcript=transcript,
        detected_language=raw_language,
        audio_base64=audio_base64,
        audio_format=audio_format,
    )


# ---------------------------------------------------------------------------
# Synthetic Demo Endpoints (/api/v1/demo/*)
# ---------------------------------------------------------------------------
from backend.app.db.repositories import SyntheticDemoRepository
import pathlib
import json


def _model_to_dict(obj: Any) -> dict[str, Any]:
    """Helper to convert SQLAlchemy model instance to dictionary."""
    if obj is None:
        return {}
    res = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            res[col.name] = val.isoformat()
        elif isinstance(val, uuid.UUID):
            res[col.name] = str(val)
        else:
            res[col.name] = val
    return res


@router.get("/demo/manifest", tags=["Synthetic Demo"])
def get_demo_manifest() -> dict[str, Any]:
    """Retrieve the manifest and metadata for the SAMUDRA synthetic demo dataset."""
    manifest_path = pathlib.Path(__file__).resolve().parent.parent.parent.parent / "data" / "fixtures" / "synthetic" / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "dataset_name": "SAMUDRA_DEMO_V1",
        "description": "Deterministic synthetic marine, weather, EO, and operational demo dataset for SAMUDRA",
        "status": "active",
    }


@router.get("/demo/stakeholders", tags=["Synthetic Demo"])
def get_demo_stakeholders(namespace: str = "SAMUDRA_DEMO_V1") -> list[dict[str, Any]]:
    """List all synthetic demo stakeholders."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_stakeholders(namespace=namespace)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/harbors", tags=["Synthetic Demo"])
def get_demo_harbors(namespace: str = "SAMUDRA_DEMO_V1") -> list[dict[str, Any]]:
    """List all synthetic demo harbors."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_harbors(namespace=namespace)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/fishers", tags=["Synthetic Demo"])
def get_demo_fishers(namespace: str = "SAMUDRA_DEMO_V1") -> list[dict[str, Any]]:
    """List all synthetic demo fishers."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_fishers(namespace=namespace)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/vessels", tags=["Synthetic Demo"])
def get_demo_vessels(namespace: str = "SAMUDRA_DEMO_V1") -> list[dict[str, Any]]:
    """List all synthetic demo vessels."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_vessels(namespace=namespace)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/trips", tags=["Synthetic Demo"])
def get_demo_trips(namespace: str = "SAMUDRA_DEMO_V1") -> list[dict[str, Any]]:
    """List all synthetic demo fishing trips."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_trips(namespace=namespace)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/marine-observations", tags=["Synthetic Demo"])
def get_demo_marine_observations(
    harbor_id: str | None = None, namespace: str = "SAMUDRA_DEMO_V1"
) -> list[dict[str, Any]]:
    """List synthetic demo marine observations."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_marine_observations(namespace=namespace, harbor_id=harbor_id)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/eo-grid-cells", tags=["Synthetic Demo"])
def get_demo_eo_grid_cells(
    cell_id: str | None = None, namespace: str = "SAMUDRA_DEMO_V1"
) -> list[dict[str, Any]]:
    """List synthetic Earth Observation grid cell data."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_eo_grid_cells(namespace=namespace, cell_id=cell_id)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/pfz-candidates", tags=["Synthetic Demo"])
def get_demo_pfz_candidates(
    valid_only: bool = False, namespace: str = "SAMUDRA_DEMO_V1"
) -> list[dict[str, Any]]:
    """List synthetic Potential Fishing Zone (PFZ) advisory candidates."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_pfz_candidates(namespace=namespace, valid_only=valid_only)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/geofences", tags=["Synthetic Demo"])
def get_demo_geofences(namespace: str = "SAMUDRA_DEMO_V1") -> list[dict[str, Any]]:
    """List synthetic demo maritime geofences and restricted zones."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_geofences(namespace=namespace)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/routes", tags=["Synthetic Demo"])
def get_demo_routes(namespace: str = "SAMUDRA_DEMO_V1") -> dict[str, Any]:
    """List synthetic demo maritime route graph (nodes and edges)."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        nodes = repo.get_route_nodes(namespace=namespace)
        edges = repo.get_route_edges(namespace=namespace)
        return {
            "nodes": [_model_to_dict(n) for n in nodes],
            "edges": [_model_to_dict(e) for e in edges],
        }


@router.get("/demo/hazards", tags=["Synthetic Demo"])
def get_demo_hazards(
    status: str | None = None, namespace: str = "SAMUDRA_DEMO_V1"
) -> list[dict[str, Any]]:
    """List synthetic demo marine weather hazard advisories."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_hazards(namespace=namespace, status=status)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/notifications", tags=["Synthetic Demo"])
def get_demo_notifications(
    role: str | None = None, is_read: bool | None = None, namespace: str = "SAMUDRA_DEMO_V1"
) -> list[dict[str, Any]]:
    """List synthetic demo notifications and safety advisories."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_notifications(namespace=namespace, role=role, is_read=is_read)
        return [_model_to_dict(item) for item in items]


@router.get("/demo/vessels/{vessel_id}/replay", tags=["Synthetic Demo"])
def get_demo_vessel_replay(
    vessel_id: str, namespace: str = "SAMUDRA_DEMO_V1"
) -> list[dict[str, Any]]:
    """Get recorded replay track positions for a specific vessel."""
    with SessionLocal() as session:
        repo = SyntheticDemoRepository(session)
        items = repo.get_vessel_replay(namespace=namespace, vessel_id=vessel_id)
        return [_model_to_dict(item) for item in items]



