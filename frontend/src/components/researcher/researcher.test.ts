import { describe, it, expect, vi } from 'vitest';
import OceanDataExplorer from './OceanDataExplorer';
import DataSourceMonitor from './DataSourceMonitor';
import ScenarioLab from './ScenarioLab';
import QueryWorkbench from './QueryWorkbench';
import ResearcherPage from '../../pages/ResearcherPage';
import {
  fetchHarbors,
  fetchMarineObservations,
  fetchEOGridCells,
  fetchPFZCandidates,
  fetchHazards,
  fetchScenarios,
  runScenario,
  fetchHealthStatus,
  DATA_SOURCES,
} from '../../api/researcher-client';

describe('Researcher Dashboard Components & Data Client', () => {
  it('exports all researcher deck components cleanly', () => {
    expect(OceanDataExplorer).toBeDefined();
    expect(typeof OceanDataExplorer).toBe('function');

    expect(DataSourceMonitor).toBeDefined();
    expect(typeof DataSourceMonitor).toBe('function');

    expect(ScenarioLab).toBeDefined();
    expect(typeof ScenarioLab).toBe('function');

    expect(QueryWorkbench).toBeDefined();
    expect(typeof QueryWorkbench).toBe('function');

    expect(ResearcherPage).toBeDefined();
    expect(typeof ResearcherPage).toBe('function');
  });

  it('validates 4 researcher decks enumeration', () => {
    const decks: Array<'ocean' | 'sources' | 'scenarios' | 'query'> = [
      'ocean',
      'sources',
      'scenarios',
      'query',
    ];
    expect(decks).toHaveLength(4);
    expect(decks).toContain('ocean');
    expect(decks).toContain('sources');
    expect(decks).toContain('scenarios');
    expect(decks).toContain('query');
  });

  it('fetches harbors fallback with valid coordinates', async () => {
    const harbors = await fetchHarbors();
    expect(harbors.length).toBeGreaterThanOrEqual(2);
    const ratnagiri = harbors.find(h => h.public_id === 'harbor-ratnagiri');
    expect(ratnagiri).toBeDefined();
    expect(ratnagiri?.latitude).toBeCloseTo(16.99, 1);
    expect(ratnagiri?.longitude).toBeCloseTo(73.28, 1);
  });

  it('fetches marine observations filtered by harbor', async () => {
    const ratObs = await fetchMarineObservations('harbor-ratnagiri');
    expect(ratObs.length).toBeGreaterThan(0);
    for (const obs of ratObs) {
      expect(obs.harbor_id).toBe('harbor-ratnagiri');
      expect(obs.wave_height_m).toBeGreaterThan(0);
      expect(obs.sst_celsius).toBeGreaterThan(20);
      expect(obs.quality_flags.length).toBeGreaterThan(0);
    }
  });

  it('fetches EO grid cells with satellite metadata and tolerates null/obscured values', async () => {
    const cells = await fetchEOGridCells();
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.cell_id).toBeTruthy();
      expect(cell.satellite).toBeTruthy();
      // Values can be null when satellite cell is cloud obscured or no-data
      if (cell.chlorophyll_a_mg_m3 !== null) {
        expect(cell.chlorophyll_a_mg_m3).toBeGreaterThan(0);
      }
    }
  });

  it('fetches PFZ advisory candidates with sst_gradient and without fake absolute sst_celsius', async () => {
    const pfz = await fetchPFZCandidates();
    expect(pfz.length).toBeGreaterThan(0);
    const rank1 = pfz.find(p => p.rank === 1);
    expect(rank1).toBeDefined();
    expect(rank1?.distance_km).toBeGreaterThan(0);
    expect(rank1?.bearing_deg).toBeGreaterThanOrEqual(0);
    // Semantic verification: sst_gradient must be preserved as gradient (< 10.0), never absolute SST (~28°C)
    for (const p of pfz) {
      expect((p as any).sst_celsius).toBeUndefined();
      if (p.sst_gradient !== null) {
        expect(p.sst_gradient).toBeGreaterThanOrEqual(0);
        expect(p.sst_gradient).toBeLessThan(10); // Thermal gradient metric is < 10 °C/km or unitless index
      }
    }
  });

  it('fetches active hazard bulletins', async () => {
    const hazards = await fetchHazards();
    expect(hazards.length).toBeGreaterThan(0);
    const warning = hazards.find(h => h.severity === 'WARNING');
    expect(warning).toBeDefined();
    expect(warning?.headline).toBeTruthy();
    expect(warning?.source).toBeTruthy();
  });

  it('fetches S1–S8 scenario manifest and executes scenario evaluation', async () => {
    const scenarios = await fetchScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(8);
    expect(scenarios.some(s => s.id === 'S1')).toBe(true);

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          scenario_id: 'S1',
          passed: true,
          actual_status: 'CAUTION',
          actual_confidence: 'HIGH',
          evidence_count: 4,
          trace_steps_count: 6,
          execution_time_ms: 120,
          response_text: 'Depart with caution due to wave heights.',
          executed_tools: ['marine_conditions', 'weather_conditions'],
          validation_notes: ['Wave threshold within limits'],
          warnings: [],
        }),
      } as any);

      const result = await runScenario('S1');
      expect(result.scenario_id).toBe('S1');
      expect(result.is_error).toBeFalsy();
      expect(result.passed).toBe(true);
      expect(result.recommendation_status).toBe('CAUTION');
      expect(result.evidence_count).toBe(4);
      expect(result.trace_steps).toBe(6);
      expect(result.executed_tools).toContain('marine_conditions');
      expect(result.decisive_factors).toContain('Wave threshold within limits');
      expect(typeof result.execution_time_ms).toBe('number');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('regression: backend scenario failure produces explicit error state without fabricated random results', async () => {
    const originalFetch = globalThis.fetch;
    const randomSpy = vi.spyOn(Math, 'random');
    try {
      // Mock fetch rejection (backend unavailable)
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await runScenario('S1');

      // Must produce explicit error state
      expect(result.is_error).toBe(true);
      expect(result.status).toBe('error');
      expect(result.recommendation_status).toBe('UNKNOWN');
      expect(result.confidence_level).toBe('UNKNOWN');
      expect(result.evidence_count).toBe(0);
      expect(result.trace_steps).toBe(0);
      expect(result.decisive_factors).toEqual([]);
      expect(result.answer).toContain('Scenario execution unavailable');

      // Math.random must NOT have been called to invent metrics
      expect(randomSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      randomSpy.mockRestore();
    }
  });

  it('regression: HTTP 500 error produces explicit error state without fake metrics', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      } as any);

      const result = await runScenario('S2');
      expect(result.is_error).toBe(true);
      expect(result.status).toBe('error');
      expect(result.evidence_count).toBe(0);
      expect(result.trace_steps).toBe(0);
      expect(result.confidence_level).toBe('UNKNOWN');
      expect(result.answer).toContain('Scenario execution unavailable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fetches health status and validates authoritative data sources registry', async () => {
    const health = await fetchHealthStatus();
    expect(health.status).toBeTruthy();
    expect(health.app_name).toBe('SAMUDRA');

    expect(DATA_SOURCES.length).toBeGreaterThanOrEqual(7);
    const imd = DATA_SOURCES.find(s => s.provider === 'IMD' && s.name.includes('Cyclone'));
    expect(imd).toBeDefined();
    expect(imd?.status).toBe('online');
  });

  it('exposes canonical DATA MODE disclosure constants for Researcher Lab', async () => {
    const { CANONICAL_DATA_MODE_LABEL, CANONICAL_DATA_MODE_TOOLTIP } = await import('../../api/researcher-client');
    expect(CANONICAL_DATA_MODE_LABEL).toBe('DATA MODE: SYNTHETIC DEMO / SNAPSHOT');
    expect(CANONICAL_DATA_MODE_TOOLTIP).toContain('Deterministic synthetic data');
    expect(CANONICAL_DATA_MODE_TOOLTIP).toContain('not connected to live operational feeds');
  });
});
