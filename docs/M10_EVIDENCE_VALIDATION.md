# Milestone M10 — Evidence Validation & Hallucination Prevention

> **Project:** SAMUDRA — Smart Autonomous Marine Understanding, Decision & Risk Assistant  
> **SIH Problem Statement:** PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  
> **Milestone:** M10 — Evidence Validation & Grounding Architecture  
> **Owner:** Dev 3 — Agent Orchestration, Conversation & Explainability  

---

## 1. Executive Summary & Core Principle

In marine voyage safety, hallucinated numerical facts can lead to catastrophic operational decisions. If an agent asserts that wave heights are safe or wind speeds are mild without authoritative backing from marine and meteorological sensor feeds, mariners face severe physical danger.

Milestone M10 establishes the invariant:

$$\textbf{EVERY NUMERICAL CLAIM IN THE FINAL RESPONSE MUST BE DETERMINISTICALLY TRACEABLE TO VALID EVIDENCE.}$$

```
Tool Execution (Dev 2/4)
       ↓
ToolResult with EvidenceItems & evidence_id
       ↓
LangGraph specialist_tools_node
       ↓
EvidenceValidator (Auditing completeness, freshness, conflicts)
       ↓
ResponseComposer (LLM drafting with strict citation directives)
       ↓
Deterministic Claim-to-Evidence Validation & Hallucination Suppression
       ↓
Safety Invariance Verification (M5 Guard)
       ↓
Final Localized ChatResponse
```

---

## 2. EvidenceItem Lifecycle & Graph Propagation

### 2.1 EvidenceItem Contract
The core typed evidence model resides in `backend/app/contracts/chat.py` and `backend/app/agents/evidence.py`:

```python
class EvidenceItem(BaseModel):
    id: str = Field(default_factory=lambda: f"EV-{uuid4().hex[:8].upper()}")
    evidence_id: Optional[str] = None  # Machine-verifiable identifier (e.g., EV-WAVE-101)
    source_name: str
    source_type: str
    timestamp: datetime
    data_points: Dict[str, Any]
    quality_flags: List[str]
    confidence_score: float
```

### 2.2 Propagation Through the Graph
1. **Tool Execution (Dev 2 / Dev 4 Adapters)**:
   - Tool providers execute domain algorithms and wrap observations in `ToolResult`.
   - Adapters produce `EvidenceRecord` or `EvidenceItem` stamped with `evidence_id`, timestamp, and authoritative data points.
2. **Specialist Tools Node (`specialist_tools_node`)**:
   - Aggregates `EvidenceItem` instances from all executed specialist tools into `state["evidence_items"]`.
   - Enforces unique deterministic `evidence_id` assignment for any item lacking one.
3. **Evidence Validator Node (`evidence_validator_node`)**:
   - Audits evidence completeness across all planned capabilities.
   - Detects and flags stale or conflicting evidence records.
4. **Response Composer Node (`response_composer_node`)**:
   - Feeds verified `EvidenceItem` entries and `evidence_id` references into prompt context.
   - Audits the LLM-generated draft or template output against available evidence.
   - Filters/suppresses unsupported numerical claims before building the final `ChatResponse`.

---

## 3. Claim-to-Evidence Mapping Architecture

### 3.1 Multilingual Numerical Claim Extraction
The `EvidenceValidator.extract_numerical_claims(text)` engine scans generated text across English, Hindi, and Marathi for numerical marine claims using localized regex and Devanagari numeral translation:

- **Metrics Detected**:
  - `wave_height_m`: Meters (`m`, `मी`, `मीटर`)
  - `wind_speed_kmh`: Kilometers per hour (`km/h`, `kmph`, `किमी/तास`, `किमी/घंटा`)
  - `visibility_km`: Distance visibility (`km`, `किमी`)
  - `rainfall_mm`: Precipitation (`mm`, `मिमी`)
  - `sea_temp_c`: Sea surface temperature (`°C`, `C`, `डिग्री`)
  - `water_depth_m`: Depth (`m`, `मी`)
  - `distance_km`: Passage / boundary distance (`km`, `किमी`)
  - `bearing_deg`: Heading (`°`, `deg`, `अंश`)
  - `exposure_score`: Route risk index ($0.0 - 1.0$)
  - `hazard_distance_km`: Proximity to hazards/geofences (`km`, `किमी`)
  - `swell_period_s`: Swell period in seconds (`s`, `सेकंद`)

### 3.2 Citation Binding
Each extracted claim is bound to an explicit citation tag (e.g., `[EV123]`) situated within its clause. The validator maps:

$$\text{Claim}(\text{metric}, \text{value}) \longrightarrow \text{evidence\_id} \longrightarrow \text{EvidenceItem} \longrightarrow \text{source/tool}$$

---

## 4. Deterministic Validation & Edge Cases

### 4.1 Missing Evidence
If a tool output contains a numerical value without a valid `EvidenceItem` or citation ID, the validator rejects the claim. It is never presented as an authoritative fact.

### 4.2 Stale Evidence
The validator checks `EvidenceItem.timestamp` against the current operational window. If the timestamp exceeds the freshness threshold ($>6$ hours for weather/marine, $>1$ hour for live hazards):
- The evidence is marked as `is_stale=True`.
- It cannot ground current operational numerical claims.

### 4.3 Conflicting Evidence
When multiple tools or sources report contradictory values for the same metric (e.g., wave height $2.1\text{ m}$ vs $3.4\text{ m}$):
- If timestamps allow unambiguous recency resolution, the fresher record is prioritized.
- If timestamps are identical or unresolvable, the validator marks an evidence conflict, suppresses single-value assertions, and issues an explicit uncertainty notice.

### 4.4 Partial Evidence
If evidence exists for wave height ($2.1\text{ m}$) and visibility ($5.0\text{ km}$), but not wind speed:
- Supported claims are accepted with their citations.
- The unsupported wind speed claim is deterministically pruned.
- The valid portion of the response is preserved without rejecting the entire message.

---

## 5. Unsupported Claim Suppression

When an LLM response draft includes ungrounded numerical claims, `EvidenceValidator.suppress_unsupported_claims()` prunes the invalid clauses at clause or sentence boundaries:

- **Example**:
  - *Draft:* `"Wave height is 2.1 m [EV-WAVE-101], visibility is 5.0 km [EV-VIS-202], and wind speed is 31 km/h."`
  - *Validation:* Wave height and visibility are valid; wind speed lacks citation/evidence.
  - *Suppressed Result:* `"Wave height is 2.1 m [EV-WAVE-101], visibility is 5.0 km [EV-VIS-202]."`

If the entire text is corrupted or unresolvable, the system safely falls back to the deterministic, verified response composer template.

---

## 6. Safety Invariance Integration (M5)

Evidence validation and safety invariance operate as sequential, independent gates:

$$\text{Evidence Validation Gate} \longrightarrow \text{Safety Invariance Gate} \longrightarrow \text{Final Response}$$

- Evidence validation **cannot** upgrade a safety recommendation status (`NO_GO`, `CAUTION`, `UNKNOWN`).
- `ResponseComposer.validate_safety_invariance()` and `PromptInjectionGuard.audit_response_for_tampering()` ensure that even an evidence-grounded response cannot alter authoritative risk determinations.

---

## 7. Verification & Test Suite

The M10 test suite in `tests/agent_eval/test_m10_evidence.py` covers 26 test specifications:

| Test Name | Focus | Result |
| :--- | :--- | :--- |
| `test_evidence_ids_survive_the_graph` | End-to-end evidence ID propagation | **PASSED** |
| `test_numerical_claim_with_valid_evidence_is_accepted` | Correct claim grounding | **PASSED** |
| `test_numerical_claim_without_evidence_is_rejected` | Uncited claim rejection | **PASSED** |
| `test_unsupported_wind_speed_claim_is_suppressed` | Selective clause suppression | **PASSED** |
| `test_missing_evidence_on_tool_result_rejected_as_fact` | Tool result with empty evidence | **PASSED** |
| `test_invalid_evidence_id_is_rejected` | Non-existent evidence ID detection | **PASSED** |
| `test_stale_evidence_cannot_ground_current_claim` | Timestamp freshness expiration | **PASSED** |
| `test_conflicting_evidence_is_detected` | Contradictory observation handling | **PASSED** |
| `test_partial_evidence_allows_supported_claims` | Multi-metric partial grounding | **PASSED** |
| `test_multiple_numerical_claims_map_to_appropriate_evidence` | Multi-claim discrete mapping | **PASSED** |
| `test_llm_cannot_invent_evidence_id` | Hallucinated citation tag blocking | **PASSED** |
| `test_llm_cannot_cite_unrelated_evidence` | Wrong-metric citation blocking | **PASSED** |
| `test_evidence_included_in_final_response` | Final ChatResponse citations list | **PASSED** |
| `test_go_status_remains_invariant_under_evidence_validation` | Invariance for GO status | **PASSED** |
| `test_caution_status_remains_invariant_under_evidence_validation` | Invariance for CAUTION status | **PASSED** |
| `test_no_go_status_remains_invariant_under_evidence_validation` | Invariance for NO_GO status | **PASSED** |
| `test_unknown_status_remains_invariant_under_evidence_validation` | Invariance for UNKNOWN status | **PASSED** |
| `test_multilingual_evidence_grounding_english` | English claim extraction & grounding | **PASSED** |
| `test_multilingual_evidence_grounding_hindi` | Hindi & Devanagari numeral grounding | **PASSED** |
| `test_multilingual_evidence_grounding_marathi` | Marathi & Devanagari numeral grounding | **PASSED** |
| `test_m5_safety_flow_evidence_intact` | E2E M5 safety orchestration compatibility | **PASSED** |
| `test_m6_hazard_geofence_evidence_intact` | E2E M6 hazard geofence compatibility | **PASSED** |
| `test_m7_route_evidence_intact` | E2E M7 route reasoning compatibility | **PASSED** |
| `test_m9_llm_multilingual_with_evidence_intact` | E2E M9 multilingual LLM compatibility | **PASSED** |
| `test_fakellmprovider_hallucinated_claim_rejection_offline` | 100% offline hallucination testing | **PASSED** |
| `test_evidence_record_to_chat_evidence_item_conversion` | Adapter contract preservation | **PASSED** |

**Total Suite Result**: **265/265 passed** across the entire repository.
