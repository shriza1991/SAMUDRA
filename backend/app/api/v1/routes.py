"""API v1 Routing for SAMUDRA.

Owned by Dev 2 (Backend Platform).
Routes declare types and inputs, connecting to LangGraph orchestrator when implemented.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status

from backend.app.contracts.chat import ChatRequest, ChatResponse
from backend.app.core.config import settings

router = APIRouter(prefix="/api/v1")


@router.get("/health", tags=["System"])
async def health_check():
    """System health check and operational mode discovery."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "app_env": settings.APP_ENV,
        "data_mode": settings.DATA_MODE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    tags=["Agentic Chat"],
    summary="Submit query to LangGraph Bounded Agent Pipeline",
)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Entrypoint for marine natural-language queries.

    NOTE: Placeholder scaffold for Dev 2 & Dev 3 integration.
    Actual LangGraph execution graph will be invoked here upon Day 1 kickoff.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "LangGraph Agent Runtime scaffolded. Awaiting Day 1 Dev 2 & Dev 3 "
            "graph wiring per docs/AGENT_WORKFLOW.md."
        ),
    )


@router.get("/scenarios", tags=["Evaluation & Demo"])
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
