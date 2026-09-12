# ORCA SPECS — System Requirements & Acceptance Criteria

## Canonical interfaces
Primary interaction: `POST /api/v1/chat`

Core shared models:
- ChatRequest
- ChatResponse
- VoiceChatResponse
- ToolResult
- EvidenceItem

Canonical definitions remain in docs/API_CONTRACTS.md and docs/CANONICAL_DATA_CONTRACTS.md.

## Runtime flow
1. Normalize input
2. Detect language/locale
3. Resolve mission context
4. Clarification gate
5. Intent classification
6. Supervisor planning
7. Specialist tool execution
8. Evidence normalization and validation
9. Deterministic safety/regulatory evaluation
10. Candidate elimination and ranking
11. Alternative generation
12. Response composition
13. Map/evidence/trace packaging
14. Persist run metadata

## Evidence
Every important numerical or safety claim must retain:
- source/product
- observed/issue time
- valid-from/to
- retrieved-at
- spatial applicability
- quality flags
- authority/usage classification

## Deterministic boundaries
LLMs may own:
- language understanding
- task decomposition
- bounded tool planning
- context handling
- explanation

Deterministic code owns:
- geodesics
- polygon intersections
- freshness/validity
- hard safety/regulatory constraints
- feasibility
- ranking calculations
- provenance-based confidence

## Safety
The rules in docs/SAFETY.md are invariant. No feature may weaken or bypass them.

## Data modes
- LIVE
- HYBRID
- SNAPSHOT

Each mode must have explicit behavior and tests.

## Release quality gates
- contract tests
- deterministic domain tests
- connector tests
- agent evaluation
- integration tests
- frontend build/type checks
- failure injection
- safety regression tests
- provenance checks
- clean packaging
