"""Prompt Injection Defense & Security Guardrails for SAMUDRA / ORCA.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

Implements defense-in-depth principles:
1. Input screening against adversarial prompt injection / jailbreak patterns.
2. XML encapsulation of untrusted user messages (<user_input>...</user_input>).
3. Output assertion auditing preventing LLM from contradicting deterministic risk states.
4. Prevention of secret or chain-of-thought exposure.
"""

import re
from typing import List, Optional, Tuple

from backend.app.contracts.chat import RecommendationStatus


# Common prompt injection, jailbreak, and instruction override signatures
INJECTION_PATTERNS: List[Tuple[str, str]] = [
    (r"(?i)\bignore\s+(all\s+)?previous\s+instructions\b", "Instruction override attempt"),
    (r"(?i)\bsystem\s+override\b", "System override attempt"),
    (r"(?i)\bdisregard\s+(the\s+)?(safety|risk|rules|guidelines)\b", "Safety bypass attempt"),
    (r"(?i)\byou\s+are\s+now\s+in\s+developer\s+mode\b", "Jailbreak mode attempt"),
    (r"(?i)\breveal\s+(your\s+)?(system\s+prompt|instructions|secret|api[_\s]key)\b", "Prompt/secret extraction attempt"),
    (r"(?i)\bprint\s+(the\s+)?(system\s+prompt|hidden\s+prompt|context)\b", "Prompt extraction attempt"),
    (r"(?i)\bignore\s+(the\s+)?risk\s+engine\b", "Risk engine bypass attempt"),
    (r"(?i)\bforce\s+(status\s+)?to\s+go\b", "Forced recommendation status attempt"),
    (r"(?i)\balways\s+say\s+(it\s+is\s+)?safe\b", "Forced positive safety attempt"),
    (r"(?i)\bact\s+as\s+DAN\b", "Do Anything Now jailbreak attempt"),
]


class PromptInjectionGuard:
    """Detects and neutralizes prompt injection attacks and output safety tampering."""

    @staticmethod
    def detect_injection(user_message: str) -> Tuple[bool, Optional[str]]:
        """Scans user message for known adversarial injection / jailbreak patterns.

        Args:
            user_message: Raw incoming user prompt.

        Returns:
            Tuple of (is_malicious, detected_reason).
        """
        if not user_message:
            return False, None

        for pattern, reason in INJECTION_PATTERNS:
            if re.search(pattern, user_message):
                return True, reason

        return False, None

    @staticmethod
    def sanitize_user_input(user_message: str) -> str:
        """Wraps user input in XML boundary tags and neutralizes tag injection.

        Args:
            user_message: Raw user query string.

        Returns:
            Securely delimited prompt string.
        """
        # Strip or escape any existing XML delimiters the user might inject
        cleaned = user_message.replace("</user_input>", "").replace("<user_input>", "")
        cleaned = cleaned.replace("</context_data>", "").replace("<context_data>", "")
        return f"<user_input>\n{cleaned.strip()}\n</user_input>"

    @staticmethod
    def audit_response_for_tampering(
        synthesized_text: str,
        expected_status: RecommendationStatus,
    ) -> Tuple[bool, Optional[str]]:
        """Validates that synthesized text does not contradict the deterministic safety status.

        Args:
            synthesized_text: The natural-language draft produced by LLM.
            expected_status: The authoritative status from Dev 4 risk engine.

        Returns:
            Tuple of (is_valid, violation_reason).
        """
        text_lower = synthesized_text.lower()

        # If deterministic status is NO_GO, verify response does not declare voyage safe
        if expected_status == RecommendationStatus.NO_GO:
            safe_assertions = [
                "conditions are safe",
                "safe to sail",
                "safe to depart",
                "safe to go fishing",
                "departure is recommended",
                "proceed with voyage",
                "safe for departure",
                "[go]",
            ]
            for assertion in safe_assertions:
                if assertion in text_lower:
                    return False, f"LLM output claimed safe voyage ('{assertion}') while risk status is NO_GO"

        # If deterministic status is CAUTION, verify response does not claim unrestricted GO
        elif expected_status == RecommendationStatus.CAUTION:
            unrestricted_assertions = [
                "conditions are completely safe",
                "no risks present",
                "[go]",
            ]
            for assertion in unrestricted_assertions:
                if assertion in text_lower:
                    return False, "LLM output claimed completely safe voyage while risk status is CAUTION"

        return True, None
