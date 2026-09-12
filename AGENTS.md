# AGENTS.md — ORCA / SAMUDRA Agent Entry Rules

## READ FIRST

Before changing anything, every AI agent MUST read:

1. `AGENTS.md`
2. `SKILLS.md`
3. `README.md`
4. `docs/ORCA_MASTER_CONTEXT.md`
5. The relevant canonical contract:
   - `docs/API_CONTRACTS.md`
   - `docs/CANONICAL_DATA_CONTRACTS.md`
   - `docs/SAFETY.md`
6. `docs/OWNERSHIP.md`
7. `docs/IMPLEMENTATION_PLAN.md`
8. `docs/PROGRESS.md`
9. `docs/DECISIONS.md`

Do not begin implementation before reading the applicable documents.

## SOURCE OF TRUTH

Priority order:

1. Running code and tests
2. `docs/API_CONTRACTS.md`
3. `docs/CANONICAL_DATA_CONTRACTS.md`
4. `docs/SAFETY.md`
5. `docs/ORCA_MASTER_CONTEXT.md`
6. `docs/SPECS.md`
7. `docs/IMPLEMENTATION_PLAN.md`
8. `docs/PROGRESS.md`
9. `docs/DECISIONS.md`

If documentation conflicts with code or tests, STOP and report the conflict.

Never silently choose a version.

## BEFORE CODING

The agent must:

1. Inspect `git status`.
2. Identify the current branch.
3. Read the relevant module.
4. Check `PROGRESS.md`.
5. Check `DECISIONS.md`.
6. Confirm ownership in `OWNERSHIP.md`.
7. State the exact task being implemented.
8. Check whether another workstream owns the files being changed.

## OWNERSHIP

Never modify another member's owned files unless an explicit integration decision exists in `DECISIONS.md`.

Cross-workstream changes must begin with a contract/interface change.

## IMPLEMENTATION RULE

Prefer the smallest correct change.

Do not:

- duplicate logic
- create competing abstractions
- bypass contracts
- bypass safety rules
- hardcode demo outputs
- introduce hidden state
- silently change shared APIs

## VALIDATION

Every implementation must run the smallest relevant test first.

Before PR:

- targeted tests
- affected integration tests
- formatting/lint/type checks where applicable
- full regression suite if shared contracts changed

## DOCUMENTATION

When implementation changes:

- update `PROGRESS.md`
- add an entry to `DECISIONS.md` only when an architectural/shared decision was made
- update canonical contracts only when the actual contract changed

Do not create new documentation unless necessary.

## PR REQUIREMENT

Every PR must state:

- purpose
- files changed
- contract impact
- tests run
- risks
- integration dependencies

## STOP CONDITIONS

Stop and ask for clarification when:

- contracts conflict
- safety rules conflict
- ownership is unclear
- the repository differs materially from the documented baseline
- the requested implementation requires changing another team's boundary
