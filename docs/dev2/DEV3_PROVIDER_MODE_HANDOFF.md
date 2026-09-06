# Dev 3 Provider Mode Handoff

**To:** Dev 3 (Agent Orchestration & Explainability)
**From:** Dev 2 (Backend Platform Lead)
**Date:** 2026-09-06
**Subject:** Dev 2 Provider Integrations Available

## Status Update

Dev 2 has successfully implemented and registered the concrete provider connectors mapped to the Agent Tool Registry. The following capabilities are now backed by real data connectors (via Snapshot, Hybrid, or Live modes):

- `marine_conditions`
- `weather_conditions`
- `hazard_search`

Additionally, the `PFZSourceDataProvider` is available on the `ConnectorManager` to be consumed by Dev 4's deterministic engines.

## The Current Blocker (Action Required from Dev 3)

The newly registered tools are correctly loaded into the `AgentToolRegistry`. However, the agent graph's execution flow currently prevents them from being utilized.

Currently, the orchestration supervisor uses the new contract-driven capabilities **only** when `tool_mode == "contract_mock"`. All other `tool_mode` values forcibly inject and use the legacy M1 stubs.

**Next Steps for Dev 3:**
1. Introduce a new `provider` or `live` value for `tool_mode` in the graph execution logic.
2. Update the supervisor so that when this new mode is active, the agent queries the `AgentToolRegistry` to route calls to the concrete registered Dev 2 providers instead of the M1 stubs or the M2 contract mocks.
3. Ensure the graph context appropriately passes through `ToolInvocationContext` arguments extracted by the LLM planner.

Please reach out if you have any questions regarding the payload shapes or error handling contracts.
