# Milestone M11 — Response Composer Architecture

> **Project:** SAMUDRA — Smart Autonomous Marine Understanding, Decision & Risk Assistant  
> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Milestone:** M11 — Response Composer & Operational Presentation  
> **Owner:** Dev 3 — Agent Orchestration, Conversation & Explainability  

---

## 1. Executive Summary & Purpose

Milestone M11 formalizes the **Response Composer** in SAMUDRA / ORCA. The Response Composer is the final synthesis layer responsible for presenting complex multi-agent marine intelligence into clear, actionable, concise, localized, and verifiable operational advisories for mariners.

The Response Composer consumes:
- Authoritative deterministic risk evaluations from Dev 4 (`RecommendationStatus`, `summary`, `decisive_factors`, `next_action`)
- Evidence-backed confidence ratings (`ConfidenceLevel`, `reasons`)
- Audited and verified `EvidenceItem` records from Dev 2 / Dev 4 tools with valid `evidence_id`s
- Detected/preferred user language (`en`, `mr`, `hi`, `ta`)
- Multi-turn conversation context from M4 / M8 `ThreadContext`

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UPSTREAM AGENT GRAPH                            │
│  Dev 4 Risk Engine ──► Specialist Tools ──► Evidence Validator (M10)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Verified facts, risk, evidence
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   RESPONSE COMPOSER LAYER (M11)                        │
│                                                                        │
│  1. Recommendation Status      6. Evidence References & IDs            │
│  2. Concise Summary            7. Operational Warnings                 │
│  3. Decisive Factors           8. Contextual Suggested Follow-ups      │
│  4. Suggested Next Action      9. Same-Language Localization           │
│  5. Confidence Explanation    10. Concise Operational Template         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   SAFETY INVARIANCE & AUDIT GATE                       │
│  ResponseComposer.validate_safety_invariance() (M5 Guard)              │
│  PromptInjectionGuard.audit_response_for_tampering()                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       FINAL CHATRESPONSE MODEL                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 10 Core M11 Requirements

| # | Requirement | Implementation in SAMUDRA | Contract Field / Output |
| :--- | :--- | :--- | :--- |
| **1** | **Recommendation Status** | Explicit status (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`, `INFORMATIONAL`) calculated by Dev 4, prepended as `[<STATUS>]` header. | `Recommendation.status`, `ChatResponse.recommendation.status` |
| **2** | **Concise Summary** | Executive 1-2 sentence recommendation summary highlighting overall maritime assessment. | `Recommendation.summary` |
| **3** | **Decisive Factors** | Bulleted environmental and risk drivers (wave height, wind speed, cyclone alerts, geofence restrictions). | `Recommendation.decisive_factors` |
| **4** | **Suggested Next Action** | Direct, unambiguous operational directive for the vessel master (e.g. hold departure, maintain VHF 16 watch). | `Recommendation.next_action` |
| **5** | **Confidence Explanation** | Multilingual confidence rating (`HIGH`, `MEDIUM`, `LOW`) with explicit data justification reasons. | `ResponseComposer.format_confidence_explanation()`, `ChatResponse.confidence` |
| **6** | **Evidence References** | Machine-verifiable citations with `evidence_id`s attached to `ChatResponse.evidence` and cited in text. | `ChatResponse.evidence`, `[EV-WAVE-101]` |
| **7** | **Warnings** | Operational caveats, degraded service notices, stale sensor flags, and conflicting data alerts. | `ChatResponse.warnings` |
| **8** | **Suggested Follow-ups** | Context-aware quick reply chips tailored to the intent, status, harbor, and detected language. | `ResponseComposer.generate_suggested_followups()`, `ChatResponse.suggested_followups` |
| **9** | **Same-Language Output** | Full end-to-end localization in English (`en`), Marathi (`mr`), Hindi (`hi`), and Tamil (`ta`). | `ResponseComposer.format_concise_response()` |
| **10** | **Concise Answer Format** | Structured, scannable format free of redundant conversational filler or internal reasoning. | Standardized markdown sections |

---

## 3. Strict Invariant Guarantees

1. **Deterministic Decision Immutability**:
   - The Response Composer **never** calculates or overrides risk.
   - Dev 4 recommendation statuses (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`) are strictly immutable.
   - `ResponseComposer.validate_safety_invariance()` raises `ValueError` if any component attempts to soften or modify the status.

2. **Evidence Validation & Grounding Gate (M10)**:
   - Every numerical claim in synthesized responses must map to valid, unexpired `EvidenceItem` records.
   - Unsupported or unverified numerical claims are deterministically suppressed or trigger fallback.

3. **Language Selection Invariance (M9)**:
   - Output language strictly matches the detected or preferred language of the user.
   - All section headers, decisive factors, action directives, confidence explanations, and suggested follow-ups are rendered in the target language.

4. **Conversational Context Without Fabrication (M4/M8)**:
   - Context carry-forward (harbor, craft profile, destination) informs query resolution, but the composer never invents ungrounded facts or reuses stale risk determinations across turns.

---

## 4. Operational Template Examples

### 4.1 English Example (`en`)
```markdown
[CAUTION] Operational Advisory for Ratnagiri:

Elevated wave heights of 2.2m observed near Ratnagiri warrant caution for small craft.

Key Decisive Factors:
- Wave height 2.2m exceeds 2.0m threshold for motorized craft [EV-WAVE-101]
- Wind speeds sustained at 22.0 knots [EV-WIND-202]

Actionable Directive: Stay within 5 nautical miles of coastline and maintain VHF Channel 16 watch.

Confidence: High (Direct INCOIS satellite telemetry and IMD station observation)

Supporting Evidence:
- IMD Coastal Weather, INCOIS Ocean State Forecast

Notice: Advisory analysis based on authoritative marine and weather observations.
```

### 4.2 Marathi Example (`mr`)
```markdown
[CAUTION] रत्नागिरी साठी सागरी सुरक्षा सल्ला:

रत्नागिरी किनारपट्टीवर २.२ मीटर लाटांमुळे लहान नौकांसाठी सावधगिरीचा इशारा देण्यात येत आहे.

महत्त्वाचे घटक:
- लाटांची उंची २.२ मी (मोटाराइज्ड नौकेसाठी मर्यादा २.० मी) [EV-WAVE-101]
- वाऱ्याचा वेग २२ नॉट्स [EV-WIND-202]

कृती निर्देश: किनारपट्टीपासून ५ सागरी मैलांच्या आत राहा आणि सतत VHF चॅनल १६ वर संपर्कात राहा.

विश्वासार्हता स्तर: उच्च (अधिकृत INCOIS उपग्रह आणि IMD वेधशाळा डेटा)

पुरावा आधार:
- IMD Coastal Weather, INCOIS Ocean State Forecast

सूचना: हे मूल्यमापन अधिकृत सागरी व हवामान माहितीवर आधारित सल्लागार विश्लेषण आहे.
```

---

## 5. Verification Matrix (16 Tests)

The test suite in `tests/agent_eval/test_m11_response_composer.py` provides 100% coverage of all requirements and invariants:

| Test Name | Verified Requirement / Invariant | Status |
| :--- | :--- | :--- |
| `test_req1_recommendation_status_preservation` | Req 1: Status preservation (GO, CAUTION, NO_GO, UNKNOWN, INFORMATIONAL) | **PASSED** |
| `test_req2_concise_summary_presence` | Req 2: Concise summary presence | **PASSED** |
| `test_req3_decisive_factors_formatting` | Req 3: Decisive factors bulleted formatting | **PASSED** |
| `test_req4_suggested_next_action` | Req 4: Actionable next directive presence | **PASSED** |
| `test_req5_confidence_explanation_multilingual` | Req 5: Multilingual confidence level & reasons (EN/MR/HI/TA) | **PASSED** |
| `test_req6_evidence_references_attached_and_cited` | Req 6: Verifiable evidence citations with evidence IDs | **PASSED** |
| `test_req7_operational_warnings_included` | Req 7: Operational warnings inclusion | **PASSED** |
| `test_req8_suggested_followups_contextual_generation` | Req 8: Contextual suggested follow-ups across intents & languages | **PASSED** |
| `test_req9_same_language_output_formatting` | Req 9: Complete same-language output (MR/HI/TA/EN) | **PASSED** |
| `test_req10_concise_answer_format_structure` | Req 10: Concise, scannable operational structure | **PASSED** |
| `test_safety_invariance_guard_catches_tampering` | Invariant: Safety invariance tampering rejection (M5) | **PASSED** |
| `test_hallucination_gate_suppresses_unsupported_facts` | Invariant: Evidence validation & hallucination gate (M10) | **PASSED** |
| `test_e2e_graph_response_composition_marathi` | Invariant: End-to-end LangGraph execution in Marathi | **PASSED** |
| `test_e2e_graph_response_composition_hindi` | Invariant: End-to-end LangGraph execution in Hindi | **PASSED** |
| `test_e2e_graph_response_composition_english` | Invariant: End-to-end LangGraph execution in English | **PASSED** |
| `test_multi_turn_response_composition_preserves_context` | Invariant: Multi-turn memory without fact fabrication (M4/M8) | **PASSED** |

**Total Repository Test Count**: **281 passed, 0 failed in 2.45s**.
