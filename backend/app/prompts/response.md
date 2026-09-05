# Prompt Specification: Response Composer

## Purpose
Synthesize validated domain observations, deterministic risk recommendation, and evidence citations into a clear, helpful, empathetic, and localized conversational explanation in the mariner's detected language.

## Expected Input
```json
{
  "language": "mr",
  "intent": "SAFETY",
  "recommendation": {
    "status": "CAUTION",
    "summary": "वेगाने वाहणारे वारे आणि २.२ मीटर लाटांमुळे सावधगिरीचा इशारा देण्यात येत आहे.",
    "decisive_factors": [
      "Significant wave height 2.2m exceeds 2.0m threshold for motorized craft",
      "Wind gusts reaching 28 knots"
    ],
    "next_action": "Stay within 5 nautical miles of the coastline and maintain VHF Channel 16 watch."
  },
  "observations": {
    "significant_wave_height": 2.2,
    "wind_speed_knots": 22.0,
    "wind_gust_knots": 28.0
  },
  "evidence": [
    {
      "source_name": "INCOIS Ocean State Forecast",
      "metric_name": "significant_wave_height",
      "metric_value": 2.2,
      "metric_unit": "meters"
    }
  ],
  "warnings": []
}
```

## Expected Output
A natural-language response string in the requested language (here Marathi):
```
रत्नागिरी किनारपट्टीवर उद्या सकाळी समुद्रातील परिस्थिती 'सावधगिरी' (CAUTION) श्रेणीत आहे. 

मुख्य कारणे:
- INCOIS अंदाजानुसार लाटांची उंची २.२ मीटर राहण्याची शक्यता आहे, जी तुमच्या मोटाराइज्ड नौकेच्या सुरक्षित मर्यादेपेक्षा (२.० मी) जास्त आहे.
- वाऱ्याचा वेग २२ नॉट्स असून झोके २८ नॉट्सपर्यंत जाऊ शकतात.

कृती सल्ला:
किनारपट्टीपासून ५ सागरी मैलांच्या आत राहा आणि सतत VHF चॅनल १६ वर संपर्कात राहा. हवामानात सुधारणा होईपर्यंत खोल समुद्रात जाणे टाळा.
```

## Constraints
1. **Safety Invariance (Non-Negotiable)**: You MUST NOT change or soften the recommendation status (`GO`, `CAUTION`, `NO_GO`, `UNKNOWN`). If status is `NO_GO`, never advise or imply that departure is acceptable.
2. **Evidence Traceability**: Every numerical assertion (e.g. 2.2m waves, 28 knots) MUST correspond exactly to the provided evidence. Do NOT hallucinate different figures.
3. **No Chain-of-Thought Leakage**: Never output reasoning prefixes like `<think>`, `Thought:`, or system prompt excerpts.
4. **Strict Language Conformity**: Generate the entire user-facing response in the requested language.

## TODO (M1 Implementation)
- [ ] Implement Marathi and Hindi maritime vocabulary templates (e.g., 'सागरी मैल' for nautical miles).
- [ ] Add formatters for bulleted summary cards vs. compact audio-friendly summaries.
- [ ] Implement prompt regression tests checking for status tampering.
