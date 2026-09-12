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

  it('sends voice chat audio via POST /api/v1/voice/chat and receives VoiceChatResponse', async () => {
    const mockVoiceResponse = {
      ...MOCK_SAFETY_RESPONSE,
      transcript: 'रत्नागिरीतून उद्या सकाळी मासेमारीला जाणे सुरक्षित आहे का?',
      detected_language: 'mr-IN',
      audio_base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      audio_format: 'audio/wav',
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVoiceResponse,
    });

    const blob = new Blob(['mock-audio-bytes'], { type: 'audio/webm' });
    const { sendVoiceChat } = await import('./client');
    const result = await sendVoiceChat(blob, {
      conversation_id: 'conv-123',
      origin_harbor: 'Ratnagiri',
      craft_profile: 'motorized_boat',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/voice/chat', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    }));
    expect(result.transcript).toBe('रत्नागिरीतून उद्या सकाळी मासेमारीला जाणे सुरक्षित आहे का?');
    expect(result.detected_language).toBe('mr-IN');
    expect(result.audio_base64).toBeDefined();
    expect(result.audio_format).toBe('audio/wav');
  });

  it('throws ApiError when voice chat endpoint fails', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ detail: 'Voice pipeline execution failed' }),
    });

    const blob = new Blob(['mock-audio-bytes'], { type: 'audio/webm' });
    const { sendVoiceChat } = await import('./client');
    await expect(sendVoiceChat(blob)).rejects.toThrow(ApiError);
  });

  it('fetches base layers via GET /api/v1/layers/base', async () => {
    const mockBaseLayers = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 'POLY-NAV-01', properties: { name: 'Naval Range' } }],
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockBaseLayers,
    });

    const { getBaseLayers } = await import('./client');
    const layers = await getBaseLayers();
    expect(layers.type).toBe('FeatureCollection');
    expect(layers.features).toHaveLength(1);
  });

  it('runs scenario benchmark via POST /api/v1/scenarios/{id}/run', async () => {
    const mockBenchmark = {
      scenario_id: 'S1',
      scenario_name: 'Normal Safe',
      passed: true,
      actual_status: 'GO',
      expected_status: 'GO',
      executed_tools: ['marine_conditions'],
      evidence_count: 3,
      evidence_grounded: true,
      response_text: 'Safe to depart',
      trace_steps_count: 5,
      warnings: [],
      validation_notes: ['Match'],
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockBenchmark,
    });

    const { runScenario } = await import('./client');
    const res = await runScenario('S1');
    expect(res.passed).toBe(true);
    expect(res.actual_status).toBe('GO');
  });

  it('fetches demo vessels and replay positions', async () => {
    const { getDemoVessels, getDemoVesselReplay, getDemoNotifications } = await import('./client');
    const vessels = await getDemoVessels();
    expect(vessels.length).toBeGreaterThan(0);

    const positions = await getDemoVesselReplay('vessel-01');
    expect(positions.length).toBeGreaterThan(0);
    expect(positions[0].latitude).toBeCloseTo(16.99, 1);

    const notifs = await getDemoNotifications();
    expect(notifs.length).toBeGreaterThan(0);
  });
});


