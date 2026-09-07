import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendMessage, transcribeAudio, ApiError } from '../api/client';
import { MOCK_SAFETY_RESPONSE } from '../api/mock-data';
import { TRANSLATIONS } from '../i18n/translations';
import type { ChatRequest, TranscribeResponse } from '../types/contracts';

describe('Voice-Input and Multi-Turn Language Switching Integration', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('STT Audio Transcription Contract', () => {
    it('sends audio Blob via multipart/form-data to /api/v1/voice/transcribe', async () => {
      const mockResult: TranscribeResponse = {
        transcript: 'उद्या सकाळी रत्नागिरीहून मासेमारीसाठी जाणे सुरक्षित आहे का?',
        language: 'mr-IN',
        normalized_language: 'mr',
      };

      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const audioBlob = new Blob(['mock-audio-data-chunk'], { type: 'audio/webm' });
      const result = await transcribeAudio(audioBlob);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/voice/transcribe', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }));
      expect(result.transcript).toBe('उद्या सकाळी रत्नागिरीहून मासेमारीसाठी जाणे सुरक्षित आहे का?');
      expect(result.language).toBe('mr-IN');
      expect(result.normalized_language).toBe('mr');
    });

    it('handles STT service error without unhandled rejection', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: 'STT_UNCONFIGURED', detail: 'SARVAM_API_KEY missing' }),
      });

      const audioBlob = new Blob(['mock-audio'], { type: 'audio/webm' });
      await expect(transcribeAudio(audioBlob)).rejects.toThrow(ApiError);
    });
  });

  describe('Multi-Turn Spoken Language Switching (Marathi -> Hindi -> English)', () => {
    it('Turn 1: Spoken Marathi audio propagates normalized mr language preference and gets Marathi response', async () => {
      const mockMarathiResponse = {
        ...MOCK_SAFETY_RESPONSE,
        conversation_id: 'conv-session-multi-101',
        language: 'mr',
        answer: 'उद्या सकाळी ६ वाजता रत्नागिरीहून प्रस्थान सावधगिरीने (CAUTION) अनुकूल आहे.',
      };

      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMarathiResponse,
      });

      const chatReq: ChatRequest = {
        conversation_id: undefined,
        message: 'उद्या सकाळी रत्नागिरीहून मासेमारीसाठी जाणे सुरक्षित आहे का?',
        user_context: {
          origin_harbor: 'Ratnagiri',
          craft_profile: 'motorized_boat',
          language_preference: 'mr',
        },
      };

      const response = await sendMessage(chatReq);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"language_preference":"mr"'),
      }));
      expect(response.conversation_id).toBe('conv-session-multi-101');
      expect(response.language).toBe('mr');
      expect(response.answer).toContain('रत्नागिरी');
    });

    it('Turn 2: Spoken Hindi audio preserves conversation_id and switches to Hindi response', async () => {
      const mockHindiResponse = {
        ...MOCK_SAFETY_RESPONSE,
        conversation_id: 'conv-session-multi-101',
        language: 'hi',
        answer: 'निकटतम संभावित मत्स्य क्षेत्र (PFZ) रत्नागिरी से 18 समुद्री मील पश्चिम में स्थित है।',
      };

      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHindiResponse,
      });

      const chatReq: ChatRequest = {
        conversation_id: 'conv-session-multi-101',
        message: 'निकटतम मत्स्य क्षेत्र कहाँ है?',
        user_context: {
          origin_harbor: 'Ratnagiri',
          craft_profile: 'motorized_boat',
          language_preference: 'hi',
        },
      };

      const response = await sendMessage(chatReq);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"conversation_id":"conv-session-multi-101"'),
      }));
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({
        body: expect.stringContaining('"language_preference":"hi"'),
      }));
      expect(response.conversation_id).toBe('conv-session-multi-101');
      expect(response.language).toBe('hi');
      expect(response.answer).toContain('मत्स्य क्षेत्र');
    });

    it('Turn 3: Spoken English audio preserves conversation_id and switches to English response', async () => {
      const mockEnglishResponse = {
        ...MOCK_SAFETY_RESPONSE,
        conversation_id: 'conv-session-multi-101',
        language: 'en',
        answer: 'Weather conditions are expected to remain stable with wave heights under 1.8m.',
      };

      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEnglishResponse,
      });

      const chatReq: ChatRequest = {
        conversation_id: 'conv-session-multi-101',
        message: 'What about wind speed and wave conditions?',
        user_context: {
          origin_harbor: 'Ratnagiri',
          craft_profile: 'motorized_boat',
          language_preference: 'en',
        },
      };

      const response = await sendMessage(chatReq);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"conversation_id":"conv-session-multi-101"'),
      }));
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({
        body: expect.stringContaining('"language_preference":"en"'),
      }));
      expect(response.conversation_id).toBe('conv-session-multi-101');
      expect(response.language).toBe('en');
    });
  });

  describe('Typed Chat Backward Compatibility', () => {
    it('typed messages continue working without voice interference', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_SAFETY_RESPONSE,
      });

      const response = await sendMessage({
        message: 'Is it safe from Ratnagiri?',
      });

      expect(response.run_id).toBe(MOCK_SAFETY_RESPONSE.run_id);
    });
  });

  describe('Voice UI Translations & Accessibility Labels', () => {
    it('verifies accessibility aria labels exist for English, Hindi, and Marathi', () => {
      for (const lang of ['en', 'hi', 'mr'] as const) {
        const t = TRANSLATIONS[lang];
        expect(t.micBtnAria).toBeDefined();
        expect(t.micRecordingAria).toBeDefined();
        expect(t.micTranscribingAria).toBeDefined();
        expect(t.recordingIndicator).toBeDefined();
        expect(t.transcribingIndicator).toBeDefined();
        expect(t.micBtnAria.length).toBeGreaterThan(0);
      }
    });
  });
});
