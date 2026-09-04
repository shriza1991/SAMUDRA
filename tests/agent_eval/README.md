# Agent Evaluation Tests

> **Owned by Dev 3 (Agent Orchestration & Explainability)**

This directory tests:
1. **Intent Classification Accuracy**:
   - Classifying queries into `NEAREST_PFZ`, `GO_NO_GO_SAFETY`, `HAZARD_BOUNDARY`, `SAFER_ROUTE`, `INFORMATIONAL`.
2. **Language & Locale Extraction**:
   - Detection of English, Hindi, and Marathi user inputs.
3. **No Chain-of-Thought Leaks**:
   - Asserting that private reasoning tokens, hidden prompt strings, and raw chain-of-thought are never returned in `ChatResponse.answer` or `ChatResponse.trace`.
4. **Evidence-Claim Alignment**:
   - Verifying that any numerical claim in the synthesized answer has a matching metric in the evidence array.
