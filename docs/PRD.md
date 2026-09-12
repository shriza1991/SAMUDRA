# ORCA PRD — Product Requirements

## Product goal
Turn a mariner's mission objective into a validated, explainable, safety-constrained recommendation by orchestrating India's existing marine-information ecosystem.

## Problem
The ecosystem already contains PFZ, OSF, IMD, vessel-safety, alerts, tracking, GIS, and related capabilities. The remaining user problem is cross-system decision work: selecting evidence, aligning it in space/time, applying vessel/regulatory constraints, comparing feasible options, and explaining the result.

## Primary user
Coastal fisherman / skipper / vessel operator.

Core questions:
- Can I go?
- Where should I go?
- Which route is safer?
- What changed?
- What if I change time, vessel, or destination?

## Secondary users
- Fisheries departments
- Harbor masters
- Disaster-management authorities
- Marine researchers
- Maritime operations teams

## Product outcomes
- Mission creation and context
- Relevant evidence selection
- Deterministic safety/regulatory filtering
- Candidate ranking
- Alternative generation
- Counterfactual / what-if simulation
- Evidence-backed explanation
- Adaptive communication across web/voice/low-bandwidth modes

## Product principles
1. Safety overrides opportunity.
2. Missing data is not safe data.
3. Official source facts remain distinguishable from ORCA-derived recommendations.
4. Freshness and validity affect decisions.
5. Fail safely when critical evidence is unavailable.
6. Integrate with the ecosystem instead of claiming to replace it.

## MVP
One end-to-end mission workflow for a selected pilot geography:
- fisher/vessel profile
- voice or text mission input
- PFZ + OSF + IMD + safety/regulatory + GIS evidence
- mission timeline
- hard constraints
- candidate areas/routes
- alternatives
- what-if re-simulation
- evidence graph/map

## High-value differentiators
- Mission Twin
- Counterfactual simulation
- Constraint-aware alternatives
- Source-conflict handling
- "Why did the decision change?"
- Freshness/uncertainty visualization

## Success measures
- Time-to-decision reduction
- Reduction in manual sources consulted
- Reduction in manual comparison steps
- Safety/regulatory correctness
- Evidence coverage
- Counterfactual latency
- Alternative feasibility
- User comprehension
