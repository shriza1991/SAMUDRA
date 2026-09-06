from faster_whisper import WhisperModel

print("Loading Whisper model...")
model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)

audio_file = input("Enter path to an audio file: ").strip()

segments, info = model.transcribe(
    audio_file,
    beam_size=5,
    language=None
)

print("\n--- STT RESULT ---")
print(f"Detected language: {info.language}")
print(f"Language probability: {info.language_probability:.2f}")

print("\nLanguage probabilities:")

if hasattr(info, "all_language_probs") and info.all_language_probs:
    for lang, prob in sorted(
        info.all_language_probs,
        key=lambda x: x[1],
        reverse=True
    )[:10]:
        print(f"  {lang}: {prob:.3f}")

text = ""

for segment in segments:
    text += segment.text

print(f"\nTranscription:\n{text.strip()}")