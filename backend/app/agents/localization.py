"""Multilingual Detection, Normalization & Localization Subsystem for SAMUDRA / ORCA.

Owned by Dev 3 (Agent Orchestration & Explainability).
Part of SIH 2026 Problem Statement PS 26176 — ORCA.

Implements:
1. Deterministic script and token-based language detection (English 'en', Hindi 'hi', Marathi 'mr').
2. Bounded maritime and coastal local glossary normalization (Konkan / Marathi / Hindi terminology).
3. Localized clarification prompt generation.
4. Authoritative risk status invariance across multilingual generation.
"""

from enum import Enum
import re
from typing import Dict, List, Optional, Set

from backend.app.agents.intent import IntentCategory


class LanguageCode(str, Enum):
    """Supported ISO-639-1 language codes in SAMUDRA."""

    EN = "en"
    HI = "hi"
    MR = "mr"


SUPPORTED_LANGUAGES: Set[str] = {LanguageCode.EN.value, LanguageCode.HI.value, LanguageCode.MR.value}
DEFAULT_LANGUAGE: str = LanguageCode.EN.value


# =============================================================================
# 1. Bounded Maritime Glossary (Marathi / Hindi / Konkan Dialect Normalization)
# =============================================================================

# Canonical Harbors mapping (Devanagari, Romanized, and aliases to Canonical English)
HARBOR_GLOSSARY: Dict[str, str] = {
    # Ratnagiri & South Konkan
    "रत्नागिरी": "Ratnagiri",
    "रत्नागिरीहून": "Ratnagiri",
    "रत्नागिरीत": "Ratnagiri",
    "ratnagiri": "Ratnagiri",
    "मालवण": "Malvan",
    "मालवणातून": "Malvan",
    "मालवणहून": "Malvan",
    "malvan": "Malvan",
    # Mumbai & North Konkan
    "मुंबई": "Mumbai",
    "मुंबईहून": "Mumbai",
    "मुंबईतून": "Mumbai",
    "बॉम्बे": "Mumbai",
    "mumbai": "Mumbai",
    "bombay": "Mumbai",
    "अलिबाग": "Alibaug",
    "alibaug": "Alibaug",
    "alibag": "Alibaug",
    # Goa & Central West Coast
    "गोवा": "Goa",
    "गोव्यात": "Goa",
    "गोव्याहून": "Goa",
    "पणजी": "Panaji",
    "goa": "Goa",
    "panaji": "Panaji",
    # Gujarat Coast
    "वेरावळ": "Veraval",
    "वेरावल": "Veraval",
    "veraval": "Veraval",
    "पोरबंदर": "Porbandar",
    "porbandar": "Porbandar",
    "ओखा": "Okha",
    "okha": "Okha",
    # Karnataka & Kerala Coast
    "कारवार": "Karwar",
    "karwar": "Karwar",
    "मंगलोर": "Mangalore",
    "मंगळूर": "Mangalore",
    "mangalore": "Mangalore",
    "मालपे": "Malpe",
    "malpe": "Malpe",
    "कोची": "Kochi",
    "कोचीन": "Kochi",
    "kochi": "Kochi",
    "cochin": "Kochi",
    # East Coast & South
    "चेन्नई": "Chennai",
    "chennai": "Chennai",
    "तुतिकोरीन": "Tuticorin",
    "tuticorin": "Tuticorin",
    "विशाखापट्टणम": "Visakhapatnam",
    "विशाखापट्टनम": "Visakhapatnam",
    "visakhapatnam": "Visakhapatnam",
    "vizag": "Visakhapatnam",
    "काकीनाडा": "Kakinada",
    "kakinada": "Kakinada",
    "पारादीप": "Paradip",
    "paradip": "Paradip",
}

# Craft Type normalization
CRAFT_GLOSSARY: Dict[str, str] = {
    "होडी": "traditional_non_motorized",
    "डोंगी": "traditional_non_motorized",
    "donga": "traditional_non_motorized",
    "doni": "traditional_non_motorized",
    "hodi": "traditional_non_motorized",
    "नाव": "motorized_boat",
    "बोट": "motorized_boat",
    "नौका": "motorized_boat",
    "naav": "motorized_boat",
    "nauka": "motorized_boat",
    "boat": "motorized_boat",
    "मशीन बोट": "motorized_boat",
    "motorized": "motorized_boat",
    "ट्रॉलर": "mechanized_trawler",
    "trawler": "mechanized_trawler",
    "mechanized": "mechanized_trawler",
}

# Temporal Terminology normalization
TEMPORAL_GLOSSARY: Dict[str, str] = {
    "उद्या": "tomorrow",
    "udya": "tomorrow",
    "कल": "tomorrow",
    "kal": "tomorrow",
    "tomorrow": "tomorrow",
    "आज": "today",
    "aaj": "today",
    "today": "today",
    "आत्ता": "now",
    "atta": "now",
    "अभी": "now",
    "abhi": "now",
    "now": "now",
    "सकाळी": "morning",
    "sakali": "morning",
    "सुबह": "morning",
    "subah": "morning",
    "morning": "morning",
    "दुपारी": "afternoon",
    "dupari": "afternoon",
    "दोपहर": "afternoon",
    "dopahar": "afternoon",
    "afternoon": "afternoon",
    "संध्याकाळी": "evening",
    "sandhyakali": "evening",
    "शाम": "evening",
    "shaam": "evening",
    "evening": "evening",
    "रात्री": "night",
    "ratri": "night",
    "रात": "night",
    "raat": "night",
    "night": "night",
}


# =============================================================================
# 2. Language Detection Engine
# =============================================================================

# Distinctive grammatical and lexical markers for Marathi
MARATHI_MARKERS: List[str] = [
    # Verbs and auxiliary forms
    "आहे", "आहेत", "आहे का", "आहेत का", "नाही", "नाहीत", "जाणे", "जाऊ", "जावे", "सांगा", "सांग",
    "कशी", "कसा", "कसे", "काय", "कुठे", "जवळ", "जवळचे",
    # Nouns & maritime terms
    "उद्या", "लाटा", "मासेमारी", "होडी", "वारा", "वादळ", "चक्रीवादळ", "धोका", "धोके", "बंदर",
    "सावध", "मत्स्य", "क्षेत्र", "मार्ग", "रस्ता", "सकाळी", "दुपारी", "संध्याकाळी", "वाजता",
    "ते", "हून", "वरून", "साठी", "मध्ये", "काही", "होईल",
    # Romanized Konkan / Marathi markers
    "ahe", "aahe", "ahet", "aahet", "ahe ka", "masemari", "hodi", "udya", "sakali",
    "kuthe", "kashi", "lata", "vara", "chakrivadal", "dhoka", "jawal",
]

# Distinctive grammatical and lexical markers for Hindi
HINDI_MARKERS: List[str] = [
    # Verbs and auxiliary forms
    "क्या", "है", "हैं", "है क्या", "नहीं", "जाना", "जा सकते", "सकते हैं", "बताएं", "बताओ",
    "कैसा", "कैसी", "कैसे", "कहाँ", "कहा", "किधर", "पास", "निकटतम",
    # Nouns & maritime terms
    "कल", "तूफान", "हवा", "नाव", "मछली", "मछलियां", "पकड़ने", "चेतावनी", "सुरक्षा", "सुरक्षित",
    "बंदरगाह", "चक्रवात", "खतरा", "खतरे", "रास्ता", "सुबह", "दोपहर", "शाम", "बजे",
    "से", "तक", "के लिए", "में", "कोई", "होगा", "सकता",
    # Romanized Hindi markers
    "kya", "hai", "hain", "nahi", "jaana", "machli", "toofan", "hawa", "chetavani",
    "khatra", "kaha", "kahan", "subah", "shaam", "dopahar", "suraksha",
]


def detect_language(
    text: str,
    context_language: Optional[str] = None,
) -> str:
    """Detects query language deterministically across English ('en'), Hindi ('hi'), and Marathi ('mr').

    Algorithm:
    1. Check for Devanagari script presence.
    2. Count distinctive Marathi vs Hindi lexical/grammatical tokens.
    3. Check Romanized transliteration markers if written in Latin script.
    4. If ambiguous or short follow-up, safely preserve `context_language`.
    5. Default to 'en' when language cannot be determined.

    Args:
        text: Raw user message.
        context_language: Active language preference from ThreadContext if available.

    Returns:
        Canonical language code ('en', 'hi', or 'mr').
    """
    if not text or not text.strip():
        return context_language if context_language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE

    raw = text.strip()
    raw_lower = raw.lower()

    # Check for Devanagari Unicode block (\u0900 - \u097F)
    has_devanagari = bool(re.search(r"[\u0900-\u097F]", raw))

    if has_devanagari:
        # Score Marathi vs Hindi markers
        mr_score = 0
        hi_score = 0

        for marker in MARATHI_MARKERS:
            if re.search(r"[\u0900-\u097F]", marker) and marker in raw:
                # Weight distinctive postpositions and verbs higher
                weight = 2 if marker in ["आहे", "आहेत", "आहे का", "कुठे", "मासेमारी", "होडी", "उद्या", "चक्रीवादळ"] else 1
                mr_score += weight

        for marker in HINDI_MARKERS:
            if re.search(r"[\u0900-\u097F]", marker) and marker in raw:
                weight = 2 if marker in ["क्या", "है", "हैं", "कहाँ", "मछली", "तूफान", "चक्रवात", "खतरा"] else 1
                hi_score += weight

        if mr_score > hi_score:
            return LanguageCode.MR.value
        elif hi_score > mr_score:
            return LanguageCode.HI.value
        elif mr_score > 0:
            return LanguageCode.MR.value
        elif context_language in [LanguageCode.MR.value, LanguageCode.HI.value]:
            return context_language
        else:
            # Default Devanagari fallback to Marathi (primary Konkan mariner base)
            return LanguageCode.MR.value

    # Latin script: Check Romanized Indic markers
    mr_roman_score = sum(1 for m in MARATHI_MARKERS if not re.search(r"[\u0900-\u097F]", m) and re.search(rf"\b{m}\b", raw_lower))
    hi_roman_score = sum(1 for m in HINDI_MARKERS if not re.search(r"[\u0900-\u097F]", m) and re.search(rf"\b{m}\b", raw_lower))

    if mr_roman_score > hi_roman_score and mr_roman_score >= 1:
        return LanguageCode.MR.value
    elif hi_roman_score > mr_roman_score and hi_roman_score >= 1:
        return LanguageCode.HI.value
    elif mr_roman_score > 0 and mr_roman_score == hi_roman_score:
        return context_language if context_language in SUPPORTED_LANGUAGES else LanguageCode.MR.value

    # Check if purely English or ambiguous follow-up
    # Short continuation follow-ups like "What about the afternoon?" should keep context_language
    # unless they are clearly in English and different
    is_pure_english = bool(re.search(r"\b(is|it|safe|to|go|fishing|from|what|about|the|where|which|route|can|we|are|there|any|hazards|waves)\b", raw_lower))
    if is_pure_english:
        return LanguageCode.EN.value

    if context_language in SUPPORTED_LANGUAGES:
        return context_language

    return DEFAULT_LANGUAGE


# =============================================================================
# 3. Normalization & Local Glossary Helper
# =============================================================================

class NormalizedEntities:
    """Entities extracted and normalized via the maritime glossary."""

    def __init__(
        self,
        origin_harbor: Optional[str] = None,
        destination: Optional[str] = None,
        craft_type: Optional[str] = None,
        departure_time: Optional[str] = None,
        detected_language: str = DEFAULT_LANGUAGE,
    ) -> None:
        self.origin_harbor = origin_harbor
        self.destination = destination
        self.craft_type = craft_type
        self.departure_time = departure_time
        self.detected_language = detected_language


def normalize_maritime_entities(
    text: str,
    context_language: Optional[str] = None,
) -> NormalizedEntities:
    """Normalizes local terminology, script variations, and entities into canonical representations.

    Guarantees:
    - Does NOT mutate or fabricate domain calculations.
    - Resolves known harbors (e.g. 'रत्नागिरी' -> 'Ratnagiri', 'मुंबई' -> 'Mumbai').
    - Resolves origin and destination from Indic 'X ते Y' / 'X से Y' patterns.
    """
    lang = detect_language(text, context_language)
    raw = text.strip()
    raw_lower = raw.lower()

    explicit_harbor: Optional[str] = None
    explicit_dest: Optional[str] = None
    craft_type: Optional[str] = None
    departure_time: Optional[str] = None

    # 1. Harbor Extraction: Indic "From-To" patterns
    # Marathi pattern: "रत्नागिरी ते गोवा", "मुंबई ते गोवा"
    # Hindi pattern: "मुंबई से गोवा", "रत्नागिरी से गोवा"
    for h_orig, orig_canon in HARBOR_GLOSSARY.items():
        for h_dest, dest_canon in HARBOR_GLOSSARY.items():
            if orig_canon != dest_canon:
                if f"{h_orig} ते {h_dest}" in raw or f"{h_orig} से {h_dest}" in raw:
                    explicit_harbor = orig_canon
                    explicit_dest = dest_canon
                    break
                elif f"{h_orig} to {h_dest}" in raw_lower:
                    explicit_harbor = orig_canon
                    explicit_dest = dest_canon
                    break
        if explicit_harbor and explicit_dest:
            break

    # 2. English "from <origin> to <destination>"
    if not explicit_harbor or not explicit_dest:
        from_to_match = re.search(r"\bfrom\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)\b", raw, re.IGNORECASE)
        if from_to_match:
            c_orig = from_to_match.group(1).capitalize()
            c_dest = from_to_match.group(2).capitalize()
            explicit_harbor = HARBOR_GLOSSARY.get(c_orig.lower(), c_orig)
            explicit_dest = HARBOR_GLOSSARY.get(c_dest.lower(), c_dest)

    # 3. English "between <origin> and <destination>"
    if not explicit_harbor or not explicit_dest:
        between_match = re.search(r"\bbetween\s+([A-Za-z]+)\s+and\s+([A-Za-z]+)\b", raw, re.IGNORECASE)
        if between_match:
            c_orig = between_match.group(1).capitalize()
            c_dest = between_match.group(2).capitalize()
            explicit_harbor = HARBOR_GLOSSARY.get(c_orig.lower(), c_orig)
            explicit_dest = HARBOR_GLOSSARY.get(c_dest.lower(), c_dest)

    # 4. English "<origin> to <destination>"
    if not explicit_harbor or not explicit_dest:
        to_pair_match = re.search(r"\b([A-Za-z]+)\s+to\s+([A-Za-z]+)\b", raw, re.IGNORECASE)
        if to_pair_match:
            c_orig = to_pair_match.group(1).capitalize()
            c_dest = to_pair_match.group(2).capitalize()
            if c_orig.lower() in HARBOR_GLOSSARY or c_dest.lower() in HARBOR_GLOSSARY:
                explicit_harbor = HARBOR_GLOSSARY.get(c_orig.lower(), c_orig)
                explicit_dest = HARBOR_GLOSSARY.get(c_dest.lower(), c_dest)

    # 5. Single Harbor matches
    if not explicit_harbor:
        for h_key, h_canon in HARBOR_GLOSSARY.items():
            if re.search(r"[\u0900-\u097F]", h_key):
                if h_key in raw and h_canon != explicit_dest:
                    explicit_harbor = h_canon
                    break
            else:
                if re.search(rf"\b{h_key}\b", raw_lower) and h_canon != explicit_dest:
                    explicit_harbor = h_canon
                    break

    # 6. Craft Type normalization
    for c_key, c_val in CRAFT_GLOSSARY.items():
        if re.search(r"[\u0900-\u097F]", c_key):
            if c_key in raw:
                craft_type = c_val
                break
        else:
            if re.search(rf"\b{c_key}\b", raw_lower):
                craft_type = c_val
                break

    # 7. Departure time normalization
    for t_key, t_val in TEMPORAL_GLOSSARY.items():
        if re.search(r"[\u0900-\u097F]", t_key):
            if t_key in raw:
                departure_time = t_val
                break
        else:
            if re.search(rf"\b{t_key}\b", raw_lower):
                departure_time = t_val
                break

    return NormalizedEntities(
        origin_harbor=explicit_harbor,
        destination=explicit_dest,
        craft_type=craft_type,
        departure_time=departure_time,
        detected_language=lang,
    )


# =============================================================================
# 4. Localized Clarification Prompts
# =============================================================================

def generate_localized_clarification(
    intent: IntentCategory,
    language: str = DEFAULT_LANGUAGE,
    missing_fields: Optional[List[str]] = None,
) -> str:
    """Generates localized clarification prompts in English, Marathi, or Hindi."""
    lang_lower = (language or DEFAULT_LANGUAGE).lower()
    missing = missing_fields or []

    if "destination" in missing:
        if "origin_harbor" in missing:
            if lang_lower == LanguageCode.MR.value:
                return "मार्गावरील धोके तपासण्यासाठी, कृपया आपले प्रस्थान आणि गंतव्य बंदर (उदा. मुंबई ते गोवा) सांगा."
            elif lang_lower == LanguageCode.HI.value:
                return "मार्ग पर खतरों की जांच के लिए, कृपया अपना प्रस्थान और गंतव्य बंदरगाह (जैसे मुंबई से गोवा) बताएं।"
            else:
                return "To evaluate route hazards, which departure harbor and destination are you sailing between (e.g., from Mumbai to Goa)?"
        else:
            if lang_lower == LanguageCode.MR.value:
                return "मार्गावरील धोके व सुरक्षितता तपासण्यासाठी, कृपया आपले गंतव्य बंदर (उदा. गोवा, मुंबई) सांगा."
            elif lang_lower == LanguageCode.HI.value:
                return "मार्ग पर खतरों और सुरक्षा की जांच के लिए, कृपया अपना गंतव्य बंदरगाह (जैसे गोवा, मुंबई) बताएं।"
            else:
                return "To assess route hazards and safe passage, which destination harbor are you heading to (e.g., Goa, Mumbai)?"

    if intent == IntentCategory.PFZ:
        if lang_lower == LanguageCode.MR.value:
            return "जवळचे संभाव्य मत्स्य क्षेत्र (PFZ) शोधण्यासाठी, कृपया आपले प्रस्थान बंदर (उदा. रत्नागिरी, मालवण, वेरावळ किंवा मुंबई) सांगा."
        elif lang_lower == LanguageCode.HI.value:
            return "निकटतम मत्स्य क्षेत्र (PFZ) खोजने के लिए, कृपया अपना प्रस्थान बंदरगाह (जैसे रत्नागिरी, मालवण, वेरावल या मुंबई) बताएं।"
        else:
            return "To locate the nearest Potential Fishing Zone (PFZ), please specify your departure harbor (e.g., Ratnagiri, Malvan, Veraval, or Mumbai)."

    if lang_lower == LanguageCode.MR.value:
        return "सुरक्षिततेचा अंदाज घेण्यासाठी, कृपया आपले प्रस्थान बंदर सांगा."
    elif lang_lower == LanguageCode.HI.value:
        return "सुरक्षा मूल्यांकन के लिए, कृपया अपना प्रस्थान बंदरगाह बताएं।"
    return "To provide an accurate maritime assessment, please specify your departure harbor."
