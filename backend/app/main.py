"""FastAPI Main Application Entrypoint for SAMUDRA.

Owned by Dev 2 (Backend Platform Lead).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.v1.routes import router as api_v1_router
from backend.app.core.config import settings
from backend.app.agents.memory import memory_manager
from backend.app.db.store import SQLAlchemyConversationStore


def create_app() -> FastAPI:
    """Application factory for SAMUDRA."""
    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "Smart Autonomous Marine Understanding, Decision & Risk Assistant (SAMUDRA)\n"
            "SIH 2026 Problem Statement PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents"
        ),
        version="0.1.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API Routers
    app.include_router(api_v1_router)

    # Configure persistence
    memory_manager.set_store(SQLAlchemyConversationStore())

    @app.get("/", tags=["System"])
    async def root():
        return {
            "name": settings.APP_NAME,
            "description": "Smart Autonomous Marine Understanding, Decision & Risk Assistant",
            "sih_problem_statement": "PS 26176 - ORCA",
            "organization": "ISRO / Department of Space",
            "status": "Scaffold Ready for Day 1 Implementation",
            "docs": "/docs",
        }

    return app


app = create_app()
