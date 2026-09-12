# SKILLS.md — ORCA Engineering Skills

## Core Engineering Principles

### Contract First

Define or verify typed interfaces before implementing consumers.

### Evidence First

Every factual marine recommendation must be traceable to validated evidence.

### Deterministic Safety

LLMs may interpret language, but must never override deterministic safety decisions.

### Provider Isolation

External providers are accessed only through their adapters/interfaces.

### Spatial Correctness

Use deterministic geospatial libraries for distance, geometry, intersections, and boundaries.

### Freshness Awareness

Marine/weather observations must carry observation and validity timestamps.

### Graceful Degradation

Live provider failure must degrade to the documented fallback mode without corrupting safety state.

### Testable Boundaries

Prefer pure/domain functions that can be tested without network access.

### Multilingual Safety

Translation or language normalization must never alter the underlying safety state.

### Small Changes

Implement one coherent change at a time.

## AI-Agent Working Pattern

READ → UNDERSTAND → PLAN → IMPLEMENT → TEST → REVIEW → DOCUMENT → COMMIT

Never:

- guess repository structure
- trust stale documentation blindly
- create duplicate implementations
- modify generated artifacts manually
- weaken a safety hard-stop to make a test pass

## Required Final Check

Before completing work, verify:

- no unintended files changed
- no secrets added
- no contract mismatch
- tests pass
- progress updated
