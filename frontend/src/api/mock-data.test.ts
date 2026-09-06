import { describe, it, expect } from 'vitest';
import { MOCK_SAFETY_RESPONSE, MOCK_PFZ_RESPONSE, SAMPLE_QUERIES } from './mock-data';
import type { ChatResponse } from '../types/contracts';

describe('Contracts & Mock Data Integrity', () => {
  it('SAMPLE_QUERIES contains all 4 canonical SIH journeys', () => {
    expect(SAMPLE_QUERIES).toHaveLength(4);
    const labels = SAMPLE_QUERIES.map(q => q.label);
    expect(labels.some(l => l.includes('PFZ'))).toBe(true);
    expect(labels.some(l => l.includes('Safety'))).toBe(true);
    expect(labels.some(l => l.includes('Hazard'))).toBe(true);
    expect(labels.some(l => l.includes('Route'))).toBe(true);
  });

  it('MOCK_SAFETY_RESPONSE satisfies canonical ChatResponse contract', () => {
    const res: ChatResponse = MOCK_SAFETY_RESPONSE;
    expect(res.run_id).toBeDefined();
    expect(res.conversation_id).toBeDefined();
    expect(res.language).toBe('en');
    expect(res.intent).toBe('GO_NO_GO_SAFETY');
    expect(['GO', 'CAUTION', 'NO_GO', 'UNKNOWN', 'INFORMATIONAL']).toContain(res.recommendation.status);
    expect(res.recommendation.decisive_factors.length).toBeGreaterThan(0);
    expect(res.recommendation.next_action).toBeDefined();
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(res.confidence.level);
    expect(res.evidence.length).toBeGreaterThan(0);
    expect(res.map_layers.length).toBeGreaterThan(0);
    expect(res.trace.length).toBeGreaterThan(0);

    // Evidence freshness and origin
    res.evidence.forEach(ev => {
      expect(ev.source_name).toBeDefined();
      expect(ev.retrieved_at).toBeDefined();
      expect(Array.isArray(ev.quality_flags)).toBe(true);
    });

    // Map layer GeoJSON structure
    res.map_layers.forEach(layer => {
      expect(layer.layer_id).toBeDefined();
      expect(layer.geojson).toBeDefined();
      expect(['Feature', 'FeatureCollection']).toContain(layer.geojson.type);
    });
  });

  it('MOCK_PFZ_RESPONSE satisfies canonical ChatResponse contract', () => {
    const res: ChatResponse = MOCK_PFZ_RESPONSE;
    expect(res.intent).toBe('NEAREST_PFZ');
    expect(res.recommendation.status).toBe('GO');
    expect(res.map_layers.some(l => l.name.includes('PFZ'))).toBe(true);
    expect(res.map_layers.some(l => l.name.includes('Route'))).toBe(true);
  });
});
