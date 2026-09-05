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
    # Marathi / Hindi adversarial patterns
    (r"(?i)\bपिछला\s+निर्देश\s+(हटाएं|अनदेखा\s+करें)\b", "Instruction override attempt (Hindi)"),
    (r"(?i)\bमागील\s+सूचनांकडे\s+दुर्लक्ष\s+करा\b", "Instruction override attempt (Marathi)"),
    (r"(?i)\bसुरक्षा\s+नियम\s+(तोड़े|अनदेखा\s+करें)\b", "Safety bypass attempt (Indic)"),
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

        Checks English, Marathi, and Hindi expressions for unauthorized safe claims
        under NO_GO, CAUTION, and UNKNOWN states.

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
                "safe to proceed",
                "safe to go",
                "safe to head out",
                "departure is recommended",
                "proceed with voyage",
                "safe for departure",
                "route should probably be fine",
                "can proceed carefully",
                "restriction can be ignored",
                "safe to proceed through the restricted area",
                "proceed carefully",
                "[go]",
                # Indic multilingual assertions
                "जाणे सुरक्षित आहे",
                "मासेमारीसाठी सुरक्षित आहे",
                "समुद्रात जाणे सुरक्षित आहे",
                "परिस्थिती पूर्णपणे सुरक्षित आहे",
                "प्रस्थान सुरक्षित आहे",
                "धोका नाही",
                "काही धोका नाही",
                "प्रतिबंध दुर्लक्ष करा",
                "जाना सुरक्षित है",
                "मछली पकड़ने जाना सुरक्षित है",
                "यात्रा सुरक्षित है",
                "स्थिति पूरी तरह सुरक्षित है",
                "प्रस्थान सुरक्षित है",
                "कोई खतरा नहीं है",
                "प्रतिबंध को अनदेखा करें",
            ]
            for assertion in safe_assertions:
                if assertion.lower() in text_lower:
                    return False, f"LLM output claimed safe voyage ('{assertion}') while risk status is NO_GO"

        # If deterministic status is CAUTION, verify response does not claim unrestricted GO or ignore restrictions
        elif expected_status == RecommendationStatus.CAUTION:
            unrestricted_assertions = [
                "conditions are completely safe",
                "no risks present",
                "route should probably be fine",
                "restriction can be ignored",
                "safe to proceed through the restricted area",
                "[go]",
                # Indic multilingual assertions
                "परिस्थिती पूर्णपणे सुरक्षित आहे",
                "कोणताही धोका नाही",
                "प्रतिबंध दुर्लक्ष करा",
                "स्थिति पूरी तरह सुरक्षित है",
                "कोई जोखिम नहीं है",
                "प्रतिबंध को अनदेखा करें",
            ]
            for assertion in unrestricted_assertions:
                if assertion.lower() in text_lower:
                    return False, f"LLM output claimed completely safe voyage ('{assertion}') while risk status is CAUTION"

        # If deterministic status is UNKNOWN, verify response does not claim safe voyage
        elif expected_status == RecommendationStatus.UNKNOWN:
            unknown_violations = [
                "conditions are safe",
                "safe to sail",
                "safe to depart",
                "safe to go fishing",
                "safe to proceed",
                "safe to go",
                "safe to head out",
                "departure is recommended",
                "proceed with voyage",
                "safe for departure",
                "[go]",
                # Indic multilingual assertions
                "जाणे सुरक्षित आहे",
                "मासेमारीसाठी सुरक्षित आहे",
                "समुद्रात जाणे सुरक्षित आहे",
                "जाना सुरक्षित है",
                "यात्रा सुरक्षित है",
            ]
            for assertion in unknown_violations:
                if assertion.lower() in text_lower:
                    return False, f"LLM output claimed safe voyage ('{assertion}') while risk status is UNKNOWN"

        return True, None
