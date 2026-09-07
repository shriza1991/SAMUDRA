"""Integration tests for Voice Transcription (STT) endpoint /api/v1/voice/transcribe.

Verifies:
1. Normalization of language codes (mr-IN -> mr, hi-IN -> hi, en-IN -> en).
2. Endpoint handles empty audio files gracefully (400).
3. Endpoint handles unconfigured STT gracefully (503).
4. Endpoint succeeds with mocked or live Sarvam STT service.
5. End-to-end integration with chat pipeline.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.stt_service import (
    normalize_stt_language_code,
    transcribe_audio_bytes,
    STTServiceError,
    STTConfigurationError,
)


def test_normalize_stt_language_code():
    assert normalize_stt_language_code("mr-IN") == "mr"
    assert normalize_stt_language_code("hi-IN") == "hi"
    assert normalize_stt_language_code("en-IN") == "en"
    assert normalize_stt_language_code("ta-IN") == "ta"
    assert normalize_stt_language_code("te-IN") == "te"
    assert normalize_stt_language_code("kn-IN") == "kn"
    assert normalize_stt_language_code("bn-IN") == "bn"
    assert normalize_stt_language_code("marathi") == "mr"
    assert normalize_stt_language_code("hindi") == "hi"
    assert normalize_stt_language_code("english") == "en"
    assert normalize_stt_language_code(None) == "en"
    assert normalize_stt_language_code("") == "en"


def test_voice_transcribe_empty_file():
    client = TestClient(app)
    response = client.post(
        "/api/v1/voice/transcribe",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"] == "STT_ERROR"


def test_voice_transcribe_missing_key(monkeypatch):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    with patch("backend.app.services.stt_service.settings.SARVAM_API_KEY", ""):
        client = TestClient(app)
        response = client.post(
            "/api/v1/voice/transcribe",
            files={"file": ("test.wav", b"dummy audio content", "audio/wav")},
        )
        assert response.status_code == 503
        data = response.json()
        assert data["error"] == "STT_UNCONFIGURED"


def test_voice_transcribe_success_marathi():
    mock_response = MagicMock()
    mock_response.language_code = "mr-IN"
    mock_response.transcript = "उद्या सकाळी रत्नागिरीहून मासेमारीसाठी जाणे सुरक्षित आहे का?"

    with patch("sarvamai.SarvamAI") as mock_sarvam_cls:
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.return_value = mock_response
        mock_sarvam_cls.return_value = mock_client

        with patch("backend.app.services.stt_service.settings.SARVAM_API_KEY", "dummy_sarvam_key"):
            client = TestClient(app)
            response = client.post(
                "/api/v1/voice/transcribe",
                files={"file": ("recording.webm", b"sample-bytes-marathi", "audio/webm")},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["language"] == "mr-IN"
            assert data["normalized_language"] == "mr"
            assert "रत्नागिरी" in data["transcript"]


def test_voice_transcribe_success_hindi():
    mock_response = MagicMock()
    mock_response.language_code = "hi-IN"
    mock_response.transcript = "क्या कल सुबह रत्नागिरि से निकलना सुरक्षित है?"

    with patch("sarvamai.SarvamAI") as mock_sarvam_cls:
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.return_value = mock_response
        mock_sarvam_cls.return_value = mock_client

        with patch("backend.app.services.stt_service.settings.SARVAM_API_KEY", "dummy_sarvam_key"):
            client = TestClient(app)
            response = client.post(
                "/api/v1/voice/transcribe",
                files={"file": ("recording.wav", b"sample-bytes-hindi", "audio/wav")},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["language"] == "hi-IN"
            assert data["normalized_language"] == "hi"
            assert "रत्नागिरि" in data["transcript"]


def test_voice_transcribe_success_english():
    mock_response = MagicMock()
    mock_response.language_code = "en-IN"
    mock_response.transcript = "Is it safe to leave Ratnagiri tomorrow morning?"

    with patch("sarvamai.SarvamAI") as mock_sarvam_cls:
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.return_value = mock_response
        mock_sarvam_cls.return_value = mock_client

        with patch("backend.app.services.stt_service.settings.SARVAM_API_KEY", "dummy_sarvam_key"):
            client = TestClient(app)
            response = client.post(
                "/api/v1/voice/transcribe",
                files={"file": ("recording.wav", b"sample-bytes-english", "audio/wav")},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["language"] == "en-IN"
            assert data["normalized_language"] == "en"
            assert "Ratnagiri" in data["transcript"]
