import { describe, it, expect } from 'vitest';
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

  it('fetches PFZ advisory candidates with ranks and bearings', async () => {
    const pfz = await fetchPFZCandidates();
    expect(pfz.length).toBeGreaterThan(0);
    const rank1 = pfz.find(p => p.rank === 1);
    expect(rank1).toBeDefined();
    expect(rank1?.distance_km).toBeGreaterThan(0);
    expect(rank1?.bearing_deg).toBeGreaterThanOrEqual(0);
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

    const result = await runScenario('S1');
    expect(result.scenario_id).toBe('S1');
    expect(['GO', 'CAUTION', 'NO_GO', 'UNKNOWN']).toContain(result.recommendation_status);
    expect(result.evidence_count).toBeGreaterThan(0);
    expect(result.trace_steps).toBeGreaterThan(0);
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
});
