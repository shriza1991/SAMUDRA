import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendMessage, getHealth, getDemoScenarios, ApiError } from './client';
import { MOCK_SAFETY_RESPONSE } from './mock-data';

describe('API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends chat message and returns typed ChatResponse', async () => {
    (global.fetch as any).mockResolvedValueOnce({
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

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('Ratnagiri'),
    }));
    expect(response.run_id).toBe(MOCK_SAFETY_RESPONSE.run_id);
    expect(response.recommendation.status).toBe('NO_GO');
  });

  it('throws ApiError on non-200 responses', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ detail: 'Backend service warming up' }),
    });

    await expect(sendMessage({ message: 'test' })).rejects.toThrow(ApiError);
  });

  it('fetches health status successfully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
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
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockScenarios,
    });

    const scenarios = await getDemoScenarios();
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].id).toBe('s1');
  });
});
