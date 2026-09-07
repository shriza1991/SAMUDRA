import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendMessage, getHealth, getDemoScenarios, ApiError } from './client';
import { MOCK_SAFETY_RESPONSE } from './mock-data';

describe('API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends chat message and returns typed ChatResponse', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_SAFETY_RESPONSE,
    });

    const response = await sendMessage({
      message: 'Is it safe from Ratnagiri?',
      user_context: {
        origin_harbor: 'Ratnagiri',
        coordinates: [73.28, 16.99],
        craft_profile: 'motorized_boat',
        language_preference: 'auto',
      },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('Ratnagiri'),
    }));
    expect(response.run_id).toBe(MOCK_SAFETY_RESPONSE.run_id);
    expect(response.recommendation.status).toBe('NO_GO');
  });

  it('throws ApiError on non-200 responses', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ detail: 'Backend service warming up' }),
    });

    await expect(sendMessage({ message: 'test' })).rejects.toThrow(ApiError);
  });

  it('fetches health status successfully', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'healthy',
        data_mode: 'HYBRID',
        database: 'connected',
        timestamp: '2026-09-06T12:00:00Z',
      }),
    });

    const health = await getHealth();
    expect(health.status).toBe('healthy');
    expect(health.data_mode).toBe('HYBRID');
  });

  it('fetches demo scenarios successfully', async () => {
    const mockScenarios = [
      { id: 's1', name: 'Normal Safe', description: 'Safe conditions', query: 'Is it safe?' },
      { id: 's2', name: 'Elevated Sea', description: 'Caution wave heights', query: 'Wave alert?' },
    ];
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockScenarios,
    });

    const scenarios = await getDemoScenarios();
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].id).toBe('s1');
  });

  it('transcribes audio via POST /api/v1/voice/transcribe', async () => {
    const mockTranscribeResult = {
      transcript: 'उद्या रत्नागिरीहून जाणे सुरक्षित आहे का?',
      language: 'mr-IN',
      normalized_language: 'mr',
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTranscribeResult,
    });

    const blob = new Blob(['mock-audio-data'], { type: 'audio/webm' });
    const { transcribeAudio } = await import('./client');
    const result = await transcribeAudio(blob);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/voice/transcribe', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    }));
    expect(result.transcript).toBe('उद्या रत्नागिरीहून जाणे सुरक्षित आहे का?');
    expect(result.language).toBe('mr-IN');
    expect(result.normalized_language).toBe('mr');
  });

  it('throws ApiError when voice transcription fails', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ detail: 'Sarvam STT key not configured' }),
    });

    const blob = new Blob(['mock-audio-data'], { type: 'audio/webm' });
    const { transcribeAudio } = await import('./client');
    await expect(transcribeAudio(blob)).rejects.toThrow(ApiError);
  });
});

