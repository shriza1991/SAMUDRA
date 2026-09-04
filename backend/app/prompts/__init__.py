"""Prompts Package for SAMUDRA LangGraph Nodes.

Owned by Dev 3 (Agent Orchestration).
Contains prompt templates for:
- Intent and entity extraction
- Task planning / supervisor
- Clarification generator
- Evidence validation check
- Multilingual response composition (English, Hindi, Marathi, Tamil)

STRICT GUARDRAILS:
- Prompts must NEVER instruct the LLM to calculate distances, calculate risk,
  or hallucinate marine metrics.
- Output from prompts must adhere strictly to JSON schemas.
"""
