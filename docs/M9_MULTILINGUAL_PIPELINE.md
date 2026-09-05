# Milestone M9 — Multilingual & Local-Language Pipeline Architecture

> **Component:** SAMUDRA / ORCA Agent Subsystem (Dev 3)  
> **Problem Statement:** SIH 2026 PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Status:** COMPLETE  

---

## 1. Executive Summary & Objective

Milestone M9 introduces full end-to-end multilingual and localized language capabilities into SAMUDRA. Coastal mariners operating in Maharashtra, Goa, Gujarat, and other coastal states interact in Marathi (`mr`), Hindi (`hi`), English (`en`), or transliterated Romanized coastal terminology.

M9 integrates LLM-assisted multilingual understanding and natural response generation with deterministic validation, entity canonicalization, and localized grounded response composition into the core LangGraph reasoning pipeline **without creating separate domain reasoning pipelines for each language** and **without weakening deterministic safety invariants**.

```
User Message (English / Marathi / Hindi / Romanized)
               ↓
[Language Detection & Normalization Engine] (Deterministic script & lexical scoring + Context carry)
               ↓
[LLM Multilingual Structured Understanding] (Multilingual NLU via LLMProvider / FakeLLMProvider)
               ↓
[Deterministic Validation + Canonicalization] (Glossary maps Indic & coastal entities to canonical tokens)
               ↓
[Intent & Spatio-Temporal Extraction] (M0–M8 Intent taxonomy & Memory carry-forward)
               ↓
[Supervisor / Task Planner] (Language-independent DAG capability scheduling)
               ↓
[Specialist Tools & Engines] (Dev 2 Connectors & Dev 4 Authoritative Risk/PFZ/Route Engines)
               ↓
[Evidence & Safety Validation] (Provenance citation gate & immutable status verification)
               ↓
[LLM Multilingual Response Generation] (Same-language natural synthesis grounded in evidence)
               ↓
[Deterministic Safety & Invariance Validation] (Audit against tampering + Preserves [STATUS] header)
               ↓
Localized Final Response (Grounded in Verified Citations)
```

---

## 2. Core Architectural Pillars

### Pillar A: Deterministic Decision Immutability
- Translation or localized generation **never alters, softens, or reinterprets** the deterministic recommendation status (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`) computed by Dev 4's authoritative engines.
- `[STATUS]` invariant operational headers (e.g. `[NO_GO]`, `[CAUTION]`, `[GO]`, `[UNKNOWN]`) remain identical and untampered across English, Hindi, and Marathi outputs.
- `ResponseComposer.validate_safety_invariance()` and `PromptInjectionGuard.audit_response_for_tampering()` strictly reject any attempt to claim safe passage under `NO_GO`, `CAUTION`, or `UNKNOWN`.

### Pillar B: Evidence Grounding Preservation
- All numerical and oceanographic metrics (wave height, wind speed, distance, coordinates, exposure score) are derived strictly from verified tool evidence citations regardless of conversational language.

### Pillar C: Single Unified Orchestration Pipeline
- Tool selection, capability discovery, dependency DAG ordering, and risk evaluation remain completely language-agnostic. Language is an input understanding and output presentation layer, not a parallel reasoning fork.

### Pillar D: 100% Offline Capability with FakeLLMProvider
- All multilingual understanding, entity extraction, response drafting, and safety auditing operate deterministically and testably offline using `FakeLLMProvider`, requiring zero external API keys or cloud services for full test execution.

---

## 3. Language Detection & Normalization Architecture

Language detection operates deterministically in `backend/app/agents/localization.py`:

```python
def detect_language(text: str, context_language: Optional[str] = None) -> str:
    ...
```

1. **Devanagari Unicode Block Detection (`\u0900-\u097F`)**:
   - Scores text against distinctive Marathi lexical/grammatical tokens (e.g., `आहे`, `आहेत`, `मासेमारी`, `होडी`, `उद्या`, `लाटा`, `कुठे`, `चक्रीवादळ`, `सावध`, `ते`, `हून`).
   - Scores text against distinctive Hindi lexical/grammatical tokens (e.g., `क्या`, `है`, `हैं`, `मछली`, `तूफान`, `चक्रवात`, `खतरा`, `कहाँ`, `कल`, `सुबह`, `से`).
   - Highest-scoring language is selected.
2. **Romanized Transliteration Parsing**:
   - Detects Latin-script Hinglish/Marathish tokens (e.g., `masemari`, `hodi`, `udya`, `toofan`, `chetavani`, `khatra`, `sakali`).
3. **Contextual Memory Carry-Forward**:
   - For ambiguous, short continuation follow-ups (e.g., *"दुपारी काय परिस्थिती असेल?"* or *"What about the afternoon?"*), the active `preferred_language` from `ThreadContext` is preserved.
4. **Safe Default Fallback**:
   - Any unsupported or unrecognized scripts gracefully default to English (`en`) without pipeline degradation.

---

## 4. LLM Multilingual Understanding & Canonicalization

1. **Structured NLU via `multilingual_understanding.md`**:
   - When configured, `intent_locale_node` prompts the LLM provider to extract structured JSON conforming to `IntentExtractionResult`.
   - The LLM identifies the intent (`SAFETY`, `PFZ`, `HAZARDS`, `ROUTE`, `CONDITIONS`, `ANALYTICAL_EXPLANATION`) and entities regardless of whether phrased in English, Hindi, or Marathi.
2. **Deterministic Entity Canonicalization (`canonicalize_extracted_entities`)**:
   - LLM-extracted harbor names (e.g. `रत्नागिरी` or `मुंबई`), vessels (`होडी`, `नाव`), and temporal markers (`उद्या`, `कल`) are passed through deterministic glossaries (`HARBOR_GLOSSARY`, `CRAFT_GLOSSARY`, `TEMPORAL_GLOSSARY`).
   - Translates local terms into canonical English values (`Ratnagiri`, `Mumbai`, `tomorrow`, `motorized_boat`) before reaching the downstream DAG.
3. **Graceful Fallback on Malformed/Timeout Output**:
   - If the LLM call times out, fails, or produces malformed JSON, the pipeline immediately logs a `degraded` trace and executes the deterministic regex/glossary extractor.

---

## 5. LLM Multilingual Response Generation & Safety Auditing

1. **Localized Composition via `multilingual_response.md`**:
   - `response_composer_node` passes authoritative risk status (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`), decisive factors, next actions, and verified evidence to the LLM.
   - The LLM composes natural, empathetic responses in the requested language (`en`, `hi`, `mr`).
2. **Multilingual Safety Tampering Guard (`PromptInjectionGuard.audit_response_for_tampering`)**:
   - The draft is screened against English, Hindi, and Marathi unauthorized safe assertions (e.g., *"जाणे सुरक्षित आहे"*, *"जाना सुरक्षित है"*, *"प्रतिबंध को अनदेखा करें"*).
   - If tampering or status contradiction is detected, the draft is blocked and replaced with the deterministic localized template.
3. **Preservation of Invariant Status Header**:
   - Every generated response prepends the canonical invariant header `[GO]`, `[CAUTION]`, `[NO_GO]`, or `[UNKNOWN]` for clear mariner communication.

---

## 6. Multi-Turn Language Switching & Persistence

1. **State Preservation**:
   - `preferred_language` is maintained in `ThreadContext` and updated when a user switches languages (e.g. Turn 1 English $\rightarrow$ Turn 2 Marathi $\rightarrow$ Turn 3 Hindi).
2. **Context Retention Across Language Switches**:
   - Switching language **never clears or corrupts** operational attributes (`active_harbor`, `destination`, `active_craft_profile`, `time_window`).
3. **Localized Clarification**:
   - If required operational parameters (e.g., origin harbor) are absent, `clarification_node` immediately responds in the mariner's detected language.

---

## 7. Local Dialect Strategy & Limitations

### Strategy
- Support explicitly defined, high-frequency coastal Konkan terms (`darya` for sea, `masemari` for fishing, `lata` for waves, `hodi` for boat, `chakrivadal` for cyclone, `barti`/`ohoti` for tides).
- Normalize dialectal terminology into canonical internal tokens during input preprocessing.

### Explicit Limitations
- **No arbitrary / open-ended dialect understanding**: Regional slang or phonetically irregular sub-dialects outside the explicit glossary fall back to canonical parsing without hallucinating.
- **Authoritative entity names**: Harbor names in telemetry and tool invocations use canonical English strings (e.g., `Ratnagiri`, `Mumbai`, `Veraval`) to ensure deterministic database and GIS alignment.

---

## 8. Verification & Test Matrix

All 35 test cases in `tests/agent_eval/test_m9_multilingual.py` pass cleanly:

| Test Case | Description | Result |
| :--- | :--- | :--- |
| `test_language_detection_english` | English query detection | ✅ PASSED |
| `test_language_detection_marathi` | Marathi query detection | ✅ PASSED |
| `test_language_detection_hindi` | Hindi query detection | ✅ PASSED |
| `test_language_detection_unknown_fallback` | Unknown language fallback to 'en' | ✅ PASSED |
| `test_glossary_normalization_marathi_harbors` | Marathi harbor normalization | ✅ PASSED |
| `test_glossary_normalization_hindi_harbors` | Hindi harbor normalization | ✅ PASSED |
| `test_glossary_normalization_romanized_terms` | Romanized term normalization | ✅ PASSED |
| `test_english_safety_query_end_to_end` | E2E English safety advisory | ✅ PASSED |
| `test_marathi_safety_query_end_to_end` | E2E Marathi safety advisory | ✅ PASSED |
| `test_hindi_safety_query_end_to_end` | E2E Hindi safety advisory | ✅ PASSED |
| `test_marathi_pfz_query_end_to_end` | E2E Marathi PFZ advisory | ✅ PASSED |
| `test_hindi_hazard_query_end_to_end` | E2E Hindi hazard advisory | ✅ PASSED |
| `test_marathi_route_query_end_to_end` | E2E Marathi route advisory | ✅ PASSED |
| `test_language_carried_across_multi_turn_context` | Multi-turn language preservation | ✅ PASSED |
| `test_explicit_language_switching_preserves_context` | Multi-turn language switching | ✅ PASSED |
| `test_clarification_in_detected_language_marathi` | Marathi clarification prompt | ✅ PASSED |
| `test_clarification_in_detected_language_hindi` | Hindi clarification prompt | ✅ PASSED |
| `test_risk_status_invariance_across_translations` | NO_GO/CAUTION/UNKNOWN invariance | ✅ PASSED |
| `test_llm_assisted_multilingual_synthesis` | FakeLLMProvider multilingual synthesis | ✅ PASSED |
| `test_llm_understands_hindi_safety_query` | LLM Hindi intent/entity extraction | ✅ PASSED |
| `test_llm_understands_marathi_safety_query` | LLM Marathi intent/entity extraction | ✅ PASSED |
| `test_llm_understands_english_safety_query` | LLM English intent/entity extraction | ✅ PASSED |
| `test_llm_extracts_canonical_entities_from_multilingual_input` | Canonical entity normalization | ✅ PASSED |
| `test_llm_output_validated_and_canonicalized_by_deterministic_layer` | Deterministic layer validation | ✅ PASSED |
| `test_malformed_llm_structured_output_falls_back_to_deterministic_extraction` | Malformed LLM fallback | ✅ PASSED |
| `test_llm_timeout_or_failure_falls_back_safely` | LLM timeout/failure fallback | ✅ PASSED |
| `test_llm_generates_english_response` | LLM English response generation | ✅ PASSED |
| `test_llm_generates_hindi_response` | LLM Hindi response generation | ✅ PASSED |
| `test_llm_generates_marathi_response` | LLM Marathi response generation | ✅ PASSED |
| `test_fixed_caution_status_cannot_be_changed_by_llm_response` | CAUTION status invariance | ✅ PASSED |
| `test_fixed_no_go_status_cannot_be_changed_by_llm_response` | NO_GO status invariance | ✅ PASSED |
| `test_fixed_unknown_status_cannot_be_changed_by_llm_response` | UNKNOWN status invariance | ✅ PASSED |
| `test_multilingual_safety_tampering_rejected` | Multilingual safety tampering rejection | ✅ PASSED |
| `test_fakellmprovider_sufficient_for_all_offline_tests` | 100% offline fake provider validation | ✅ PASSED |
| `test_multiturn_language_switching_under_llm_mode` | Multi-turn language switching under LLM | ✅ PASSED |

Total repository test suite: **239 passed, 0 failed** in 2.37s. Linter: **0 ruff errors**.
