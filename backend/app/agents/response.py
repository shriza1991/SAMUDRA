"""Response Composition Contracts & Guardrails for SAMUDRA / ORCA.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

CORE INVARIANT & ETHICAL SAFETY RULES:
===============================================================================
1. DETERMINISTIC DECISION IMMUTABILITY:
   The LLM agent synthesizes and explains the safety recommendation, but
   MUST NEVER override, soften, or alter the deterministic RecommendationStatus
   (GO, CAUTION, NO_GO, UNKNOWN) calculated by Dev 4's Risk Engine.
   If Dev 4 outputs NO_GO due to a 3.5m wave height, the composer cannot say
   'it might be fine if you are careful'.

2. EVIDENCE-CLAIM ALIGNMENT:
   Every numerical claim in the generated text (wave heights, wind speeds,
   geodesic distances, coordinates) must match an entry in the evidence array.

3. SAME-LANGUAGE SENSITIVITY:
   The synthesized answer must match the detected/preferred language (Hindi,
   Marathi, Tamil, English).
===============================================================================
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from backend.app.contracts.chat import (
    AgentTraceItem,
    ChatResponse,
    Confidence,
    EvidenceItem,
    MapLayer,
    Recommendation,
)


class ResponseCompositionInput(BaseModel):
    """Input parameters passed to the Response Composer."""

    run_id: str = Field(..., description="Unique run identifier")
    conversation_id: str = Field(..., description="Session conversation identifier")
    language: str = Field("en", description="Target output language code")
    intent: str = Field(..., description="Classified intent category")
    recommendation: Recommendation = Field(..., description="Immutable deterministic safety decision")
    confidence: Confidence = Field(..., description="Derived confidence score")
    evidence: List[EvidenceItem] = Field(default_factory=list, description="Verified citations")
    map_layers: List[MapLayer] = Field(default_factory=list, description="MapLibre GeoJSON layers")
    trace: List[AgentTraceItem] = Field(default_factory=list, description="Sanitized audit trace")
    warnings: List[str] = Field(default_factory=list, description="Operational caveats")
    raw_observations: dict = Field(default_factory=dict, description="Observations dictionary")


class ResponseComposer:
    """Orchestrates response assembly, enforcing safety invariants and grounding checks."""

    @staticmethod
    def validate_safety_invariance(
        composed_response: ChatResponse,
        original_recommendation: Recommendation,
    ) -> None:
        """Verifies that the composed response does NOT tamper with the deterministic risk decision.

        Raises:
            ValueError: If status has been altered or softened.
        """
        if composed_response.recommendation.status != original_recommendation.status:
            raise ValueError(
                f"SAFETY INVARIANT VIOLATION: Composed response altered recommendation status from "
                f"'{original_recommendation.status}' to '{composed_response.recommendation.status}'. "
                f"The LLM must never override deterministic risk logic."
            )

    @staticmethod
    def build_chat_response(
        composition_input: ResponseCompositionInput,
        synthesized_answer: str,
        suggested_followups: Optional[List[str]] = None,
    ) -> ChatResponse:
        """Assembles a validated, schema-compliant ChatResponse.

        Args:
            composition_input: Validated input bundle.
            synthesized_answer: Natural language response text produced by composer prompt.
            suggested_followups: Optional relevant quick-reply options.

        Returns:
            Fully assembled ChatResponse.
        """
        response = ChatResponse(
            run_id=composition_input.run_id,
            conversation_id=composition_input.conversation_id,
            language=composition_input.language,
            intent=composition_input.intent,
            answer=synthesized_answer,
            recommendation=composition_input.recommendation,
            confidence=composition_input.confidence,
            evidence=composition_input.evidence,
            map_layers=composition_input.map_layers,
            trace=composition_input.trace,
            warnings=composition_input.warnings,
            suggested_followups=suggested_followups or [],
        )

        ResponseComposer.validate_safety_invariance(
            composed_response=response,
            original_recommendation=composition_input.recommendation,
        )

        return response
