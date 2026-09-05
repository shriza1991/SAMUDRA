# Prompt Specification: Intent & Locale Extraction

## Purpose
Classify the user's maritime query into exactly one canonical `IntentCategory` (PFZ, SAFETY, CONDITIONS, HAZARDS, ROUTE, ANALYTICAL_EXPLANATION, or UNSUPPORTED), detect the input language (e.g. English, Hindi, Marathi, Tamil), and extract operational entities (origin harbor, coordinates, departure time window, and vessel craft class).

## Expected Input
```json
{
  "user_message": "String containing the raw mariner query",
  "thread_context": {
    "active_harbor": "Ratnagiri",
    "active_craft_profile": "motorized_boat",
    "preferred_language": "mr"
  }
}
```

## Expected Output
Structured JSON conforming to `IntentExtractionResult`:
```json
{
  "intent": "SAFETY",
  "confidence": 0.95,
  "detected_language": "mr",
  "entities": {
    "origin_harbor": "Ratnagiri",
    "coordinates": [73.28, 16.99],
    "departure_time": "tomorrow morning",
    "duration_hours": 6.0,
    "craft_type": "motorized_boat",
    "target_destination": null
  },
  "missing_critical_fields": [],
  "clarification_needed": false,
  "clarification_prompt": null
}
```

## Constraints
1. **No Domain Calculations**: Do NOT compute wave heights, wind directions, distances, or safety statuses.
2. **No Factual Invention**: Do NOT invent coordinates or harbors not mentioned by the user or present in `thread_context`.
3. **No Safety Decisions**: Do NOT tell the user whether it is safe or unsafe in this node.
4. **Strict JSON Schema**: Must return valid JSON parseable into `IntentExtractionResult`.

## TODO (M1 Implementation)
- [ ] Implement few-shot classification examples for Hindi and Marathi queries.
- [ ] Integrate coastal landing center gazetteer for Konkan and Gujarat harbors.
- [ ] Add relative-time parsing rules for maritime shifts (e.g., 'morning tide', 'dawn departure').
