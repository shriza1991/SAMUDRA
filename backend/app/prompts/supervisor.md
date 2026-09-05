# Prompt Specification: Supervisor / Task Planner

## Purpose
Analyze the classified user intent and extracted spatio-temporal entities to construct a bounded, dependency-ordered sequence of specialist tools from the approved `AgentToolRegistry`.

## Expected Input
```json
{
  "intent": "PFZ",
  "location": {
    "harbor": "Ratnagiri",
    "coordinates": [73.28, 16.99]
  },
  "time_window": {
    "departure_time": "2026-09-06T06:00:00Z",
    "duration_hours": 8.0
  },
  "user_profile": {
    "craft_profile": "motorized_boat"
  },
  "available_tools": [
    "fetch_pfz_advisories",
    "marine_weather_forecast",
    "compute_pfz_distances",
    "evaluate_safety_risk"
  ]
}
```

## Expected Output
Structured JSON conforming to `TaskPlan`:
```json
{
  "intent": "PFZ",
  "steps": [
    {
      "step_number": 1,
      "tool_name": "fetch_pfz_advisories",
      "purpose": "Retrieve active Potential Fishing Zone coordinates from INCOIS",
      "depends_on": [],
      "is_parallelizable": true
    },
    {
      "step_number": 2,
      "tool_name": "marine_weather_forecast",
      "purpose": "Fetch sea-state forecast to verify passage safety to PFZ",
      "depends_on": [],
      "is_parallelizable": true
    },
    {
      "step_number": 3,
      "tool_name": "compute_pfz_distances",
      "purpose": "Calculate nautical distance and bearing from Ratnagiri to PFZ points",
      "depends_on": ["fetch_pfz_advisories"],
      "is_parallelizable": false
    },
    {
      "step_number": 4,
      "tool_name": "evaluate_safety_risk",
      "purpose": "Pass conditions to Dev 4 Risk Engine to establish Go/No-Go status",
      "depends_on": ["marine_weather_forecast"],
      "is_parallelizable": false
    }
  ],
  "requires_risk_evaluation": true,
  "planning_notes": "PFZ query requires both advisory retrieval and weather safety check."
}
```

## Constraints
1. **Registry Whitelist Only**: Must NEVER schedule a tool name not present in `available_tools`.
2. **No Direct Execution**: The planner plans execution; it does not execute the tools.
3. **Bounded Plan**: Maximum of 6 steps per plan. Never emit open-ended or recursive execution steps.
4. **Mandatory Risk Check**: Any plan that involves going to sea (PFZ, SAFETY, ROUTE) MUST include `evaluate_safety_risk`.

## TODO (M1 Implementation)
- [ ] Connect plan construction to dynamic `AgentToolRegistry.list_tools()`.
- [ ] Add dependency graph sorting (topological order) for execution dispatch.
- [ ] Add fallback tool plan when primary weather sources report degradation.
