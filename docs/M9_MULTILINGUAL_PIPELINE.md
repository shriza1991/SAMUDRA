# Milestone M9 — Multilingual & Local-Language Pipeline Architecture

> **Component:** SAMUDRA / ORCA Agent Subsystem (Dev 3)  
> **Problem Statement:** SIH 2026 PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Status:** COMPLETE  

---

## 1. Executive Summary & Objective

Milestone M9 introduces full end-to-end multilingual and localized language capabilities into SAMUDRA. Coastal mariners operating in Maharashtra, Goa, Gujarat, and other coastal states interact in Marathi (`mr`), Hindi (`hi`), English (`en`), or transliterated Romanized coastal terminology.

M9 integrates language detection, entity normalization, and localized grounded response composition into the core LangGraph reasoning pipeline **without creating separate domain reasoning pipelines for each language** and **without weakening deterministic safety invariants**.

```
User Message (English / Marathi / Hindi / Romanized)
               ↓
[Language Detection Engine] (Deterministic script & lexical scoring + Context carry)
               ↓
[Normalization / Local Glossary] (Maps coastal & Indic maritime entities to canonical forms)
               ↓
[Intent & Spatio-Temporal Extraction] (M0–M8 Intent taxonomy & Memory carry-forward)
               ↓
[Supervisor / Task Planner] (Language-independent DAG capability scheduling)
               ↓
[Specialist Tools & Engines] (Dev 2 Connectors & Dev 4 Authoritative Risk/PFZ/Route Engines)
               ↓
[Evidence & Safety Validation] (Provenance citation gate & immutable status verification)
               ↓
[Same-Language Grounded Response Composer] (Preserves [STATUS] header + Localized synthesis)
               ↓
Localized Final Response (Grounded in Verified Citations)
```

---

## 2. Core Architectural Pillars

### Pillar A: Deterministic Decision Immutability
- Translation or localized generation **never alters, softens, or reinterprets** the deterministic recommendation status (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`) computed by Dev 4's authoritative engines.
- `[STATUS]` invariant operational headers (e.g. `[NO_GO]`, `[CAUTION]`, `[GO]`, `[UNKNOWN]`) remain identical and untampered across English, Hindi, and Marathi outputs.
- `ResponseComposer.validate_safety_invariance()` strictly raises `ValueError` if any layer attempts status tampering.

### Pillar B: Evidence Grounding Preservation
- All numerical and oceanographic metrics (wave height, wind speed, distance, coordinates, exposure score) are derived strictly from verified tool evidence citations regardless of the conversational language.

### Pillar C: Single Unified Orchestration Pipeline
- Tool selection, capability discovery, dependency DAG ordering, and risk evaluation remain completely language-agnostic. Language is a presentation and input normalization layer, not a parallel reasoning fork.

---

## 3. Language Detection Architecture

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

## 4. Bounded Maritime Glossary & Normalization Layer

To support regional coastal terminology, `HARBOR_GLOSSARY`, `CRAFT_GLOSSARY`, and `TEMPORAL_GLOSSARY` provide explicit deterministic mappings:

### 1. Harbor & Landing Center Normalization
| Input Form (Devanagari / Romanized) | Canonical Output |
| :--- | :--- |
| `रत्नागिरी`, `रत्नागिरीहून`, `रत्नागिरीत`, `ratnagiri` | `Ratnagiri` |
| `मालवण`, `मालवणातून`, `malvan` | `Malvan` |
| `मुंबई`, `मुंबईहून`, `मुंबईतून`, `बॉम्बे`, `mumbai`, `bombay` | `Mumbai` |
| `गोवा`, `गोव्यात`, `पणजी`, `goa`, `panaji` | `Goa` / `Panaji` |
| `वेरावळ`, `वेरावल`, `veraval` | `Veraval` |
| `पोरबंदर`, `porbandar` | `Porbandar` |
| `कारवार`, `karwar` | `Karwar` |
| `मंगलोर`, `मंगळूर`, `mangalore` | `Mangalore` |
| `कोची`, `कोचीन`, `kochi`, `cochin` | `Kochi` |
| `चेन्नई`, `chennai` | `Chennai` |
| `विशाखापट्टणम`, `visakhapatnam`, `vizag` | `Visakhapatnam` |

### 2. Multi-Harbor Route Pattern Parsing
- Marathi: `रत्नागिरी ते गोवा` $\rightarrow$ Origin: `Ratnagiri`, Destination: `Goa`
- Hindi: `मुंबई से गोवा` $\rightarrow$ Origin: `Mumbai`, Destination: `Goa`
- English: `from Ratnagiri to Goa` $\rightarrow$ Origin: `Ratnagiri`, Destination: `Goa`

### 3. Vessel / Craft Ceiling Normalization
- Traditional Non-Motorized: `होडी`, `डोंगी`, `doni`, `donga`, `hodi` $\rightarrow$ `traditional_non_motorized`
- Motorized Boat: `बोट`, `नाव`, `नौका`, `मशीन बोट`, `naav`, `nauka`, `boat` $\rightarrow$ `motorized_boat`
- Mechanized Trawler: `ट्रॉलर`, `trawler`, `mechanized` $\rightarrow$ `mechanized_trawler`

### 4. Temporal Terminology Normalization
- `उद्या`, `udya`, `कल`, `kal`, `tomorrow` $\rightarrow$ `tomorrow`
- `आज`, `aaj`, `आत्ता`, `atta`, `अभी`, `abhi`, `now`, `today` $\rightarrow$ `now`
- `सकाळी`, `sakali`, `सुबह`, `subah`, `morning` $\rightarrow$ `morning`
- `दुपारी`, `dupari`, `दोपहर`, `dopahar`, `afternoon` $\rightarrow$ `afternoon`
- `संध्याकाळी`, `sandhyakali`, `शाम`, `shaam`, `evening` $\rightarrow$ `evening`

---

## 5. Same-Language Response Generation

The final response composer produces deterministic, high-fidelity localized answers matching the detected language:

### A. Safety Flow (`SAFETY`)
- **English**: `[CAUTION] Operational Safety Advisory for Ratnagiri:`
- **Marathi**: `[CAUTION] Ratnagiri साठी सागरी सुरक्षा सल्ला:`
- **Hindi**: `[CAUTION] Ratnagiri के लिए समुद्री सुरक्षा सलाह:`

### B. Hazard & Geofence Flow (`HAZARDS`)
- **English**: `[NO_GO] Maritime Hazard & Boundary Advisory (near Mumbai):`
- **Marathi**: `[NO_GO] सागरी धोका व सीमा क्षेत्र सल्ला (Mumbai जवळ):`
- **Hindi**: `[NO_GO] समुद्री खतरा एवं प्रतिबंधित क्षेत्र सलाह (Mumbai के पास):`

### C. Route Comparison Flow (`ROUTE`)
- **English**: `[CAUTION] Route Safety Comparison (from Ratnagiri to Goa):`
- **Marathi**: `[CAUTION] मार्ग सुरक्षा तुलना (Ratnagiri ते Goa):`
- **Hindi**: `[CAUTION] मार्ग सुरक्षा तुलना (Ratnagiri से Goa):`

### D. Potential Fishing Zones (`PFZ`)
- **English**: `[M1 DEMO DATA] A simulated Potential Fishing Zone was identified approximately 12.4 nautical miles...`
- **Marathi**: `[M1 DEMO DATA] Ratnagiri पासून अंदाजे 12.4 सागरी मैल (दिशा 285°) अंतरावर संभाव्य मत्स्य क्षेत्र (PFZ) आढळले आहे...`
- **Hindi**: `[M1 DEMO DATA] Ratnagiri से लगभग 12.4 समुद्री मील (दिशा 285°) पर संभावित मत्स्य क्षेत्र (PFZ) चिन्हित किया गया है...`

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

All 19 test cases in `tests/agent_eval/test_m9_multilingual.py` pass cleanly:

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
| `test_llm_assisted_multilingual_synthesis` | FakeLLMProvider multilingual mode | ✅ PASSED |

Total repository test suite: **223 passed, 0 failed** in 2.33s. Linter: **0 ruff errors**.
