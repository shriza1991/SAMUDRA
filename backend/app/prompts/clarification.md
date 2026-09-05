# Prompt Specification: Clarification Generator

## Purpose
Generate a concise, courteous, localized question asking the user to provide missing operational parameters (such as departure harbor, trip timing, or craft type) when safety evaluation cannot proceed without them.

## Expected Input
```json
{
  "user_message": "Can I go to sea tomorrow?",
  "missing_fields": ["origin_harbor", "craft_profile"],
  "language": "hi",
  "intent": "SAFETY"
}
```

## Expected Output
Structured JSON with localized prompt and options:
```json
{
  "clarification_prompt": "सुरक्षिततेचा अंदाज घेण्यासाठी, कृपया आपले प्रस्थान बंदर (उदा. रत्नागिरी, मालवण) आणि नौकेचा प्रकार (उदा. मोटार बोट, ट्रॉलर्स) सांगा.",
  "target_fields": ["origin_harbor", "craft_profile"],
  "suggested_chips": ["रत्नागिरी (मोटार बोट)", "मालवण (पारंपारिक होडी)", "वेरावळ (ट्रॉलर)"]
}
```

## Constraints
1. **Brevity**: Maximum 2 sentences. Do not overwhelm the user.
2. **Actionable**: Ask specifically for the missing parameters.
3. **No Hallucinated Answers**: Do NOT guess the harbor or craft and answer anyway without confirmation.
4. **Targeted Language**: Must match the user's detected language.

## TODO (M1 Implementation)
- [ ] Add regional coastal port suggestions based on user IP/GPS geolocation if available.
- [ ] Add voice-friendly short clarification variations.
