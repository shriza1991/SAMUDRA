"""Conversation Memory & Multi-Turn Context Architecture for SAMUDRA / ORCA.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

CONVERSATION MEMORY STRATEGY:
===============================================================================
In maritime safety advisory, mariners frequently query across multiple turns:
Turn 1: "Is it safe to go fishing tomorrow morning from Ratnagiri?"
Turn 2: "What about the afternoon?"

The second query must:
- Carry forward:
    * location = Ratnagiri
    * craft_profile = motorized_boat (from user profile or Turn 1)
    * activity = fishing (intent = SAFETY)
- Update:
    * time_window = tomorrow afternoon (overriding morning)
- NEVER blindly carry forward stale warnings or previous weather observations.
- Reset context if user explicitly changes geography or topic.
===============================================================================
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from backend.app.agents.intent import ExtractedEntities, IntentCategory


class ThreadContext(BaseModel):
    """Persistent stateful context retained across conversation turns for a given thread_id."""

    thread_id: str = Field(..., description="Unique persistent conversation session ID")
    active_harbor: Optional[str] = Field(None, description="Active departure harbor (e.g. 'Ratnagiri')")
    active_coordinates: Optional[List[float]] = Field(None, description="Active [lon, lat] location")
    active_craft_profile: str = Field("motorized_boat", description="Active vessel class")
    preferred_language: str = Field("en", description="Established conversation language")
    last_intent: Optional[IntentCategory] = Field(None, description="Previous turn's classified intent")
    turn_count: int = Field(0, description="Number of completed conversational turns")
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Session initiation timestamp",
    )
    last_updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Last context modification timestamp",
    )


class MemoryManager:
    """Manages multi-turn conversation memory, context carry-forward, updates, and resets."""

    def __init__(self) -> None:
        self._threads: Dict[str, ThreadContext] = {}

    def get_context(self, thread_id: str) -> ThreadContext:
        """Retrieves or creates a ThreadContext for the given thread_id."""
        if thread_id not in self._threads:
            self._threads[thread_id] = ThreadContext(thread_id=thread_id)
        return self._threads[thread_id]

    def update_context(
        self,
        thread_id: str,
        entities: ExtractedEntities,
        intent: Optional[IntentCategory] = None,
        language: Optional[str] = None,
    ) -> ThreadContext:
        """Selectively updates thread context with freshly extracted turn data.

        Applies selective carry-forward:
        - Updates harbor/coordinates only if explicitly provided in this turn.
        - Updates craft profile only if provided.
        - Updates language if detected/preferred.
        """
        ctx = self.get_context(thread_id)

        if entities.origin_harbor:
            ctx.active_harbor = entities.origin_harbor
        if entities.coordinates:
            ctx.active_coordinates = entities.coordinates
        if entities.craft_type:
            ctx.active_craft_profile = entities.craft_type
        if language:
            ctx.preferred_language = language
        if intent:
            ctx.last_intent = intent

        ctx.turn_count += 1
        ctx.last_updated_at = datetime.now(timezone.utc).isoformat()
        return ctx

    def reset_context(self, thread_id: str) -> None:
        """Completely purges context for a thread (e.g. user requests 'Reset' or 'New voyage')."""
        if thread_id in self._threads:
            del self._threads[thread_id]

    def resolve_missing_fields(
        self,
        thread_id: str,
        entities: ExtractedEntities,
        required_fields: List[str],
    ) -> List[str]:
        """Checks which required fields are missing from both current turn entities and thread memory.

        Args:
            thread_id: Conversation session ID.
            entities: Entities extracted from current turn message.
            required_fields: List of mandatory field names (e.g., ['origin_harbor', 'departure_time']).

        Returns:
            List of field names that remain unresolvable.
        """
        ctx = self.get_context(thread_id)
        still_missing: List[str] = []

        for field in required_fields:
            if field == "origin_harbor":
                if not entities.origin_harbor and not ctx.active_harbor:
                    still_missing.append(field)
            elif field == "craft_profile":
                if not entities.craft_type and not ctx.active_craft_profile:
                    still_missing.append(field)
            elif field == "departure_time":
                if not entities.departure_time:
                    still_missing.append(field)

        return still_missing


# Global memory manager instance
memory_manager = MemoryManager()
