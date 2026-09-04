"""LangGraph Agentic Orchestrator Package.

Owned by Dev 3 (Agent Orchestration & Explainability).
Responsible for:
- LangGraph StateGraph pipeline
- Intent and locale detection
- Supervisor / task planner
- Tool call dispatching
- Evidence validation gate
- Multilingual response composition
- Non-leaking activity trace generation

Must NOT implement:
- Math / geospatial distance calculations (calls Dev 4 tools)
- Risk threshold evaluations (calls Dev 4 risk engine)
- Direct external HTTP calls (calls Dev 2 connectors)
"""

from backend.app.agents.state import AgentState

__all__ = ["AgentState"]
