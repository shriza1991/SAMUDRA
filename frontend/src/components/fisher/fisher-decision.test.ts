import { describe, it, expect } from 'vitest';
import FisherDecisionSurface, {
  getFisherDecisionStatus,
  getFisherExplanation,
  extractFisherConditions,
} from './FisherDecisionSurface';
import { createHarborLayer } from '../../utils/geo';
import {
  CANONICAL_DATA_MODE_LABEL,
  CANONICAL_DATA_MODE_TOOLTIP,
} from '../../api/researcher-client';
import type { ChatResponse } from '../../types/contracts';

describe('P0-22: Fisherman Decision Surface & Local Conditions', () => {
  const mockSafeResponse: ChatResponse = {
    run_id: 'run_safe_01',
    conversation_id: 'conv_01',
    language: 'en',
    intent: 'GO_NO_GO_SAFETY',
    answer: 'Conditions are calm and safe for coastal voyage departure from Ratnagiri.',
    recommendation: {
      status: 'GO',
      summary: 'Conditions are calm and safe for coastal voyage departure.',
      decisive_factors: ['Significant wave height 1.2m is calm (< 1.5m).', 'Sustained wind 10.0 kt is favorable.'],
      next_action: 'Proceed with planned voyage under standard safety protocols.',
      threshold_comparisons: [
        {
          metric_name: 'significant_wave_height_m',
          observed_value: 1.2,
          threshold_value: 1.5,
          operator: '<',
          unit: 'meters',
          exceeded: false,
          impact: 'SAFE',
          description: 'Wave height 1.2m is safe.',
        },
        {
          metric_name: 'wind_speed_knots',
          observed_value: 10.0,
          threshold_value: 18.0,
          operator: '<',
          unit: 'knots',
          exceeded: false,
          impact: 'SAFE',
          description: 'Wind 10 kt is calm.',
        },
      ],
    },
    confidence: {
      level: 'HIGH',
      reasons: ['All parameters strictly within safe operating limits'],
    },
    evidence: [
      {
        source_name: 'INCOIS Ocean State Forecast',
        retrieved_at: '2026-09-15T06:00:00Z',
        metric_name: 'significant_wave_height',
        metric_value: 1.2,
        metric_unit: 'm',
        quality_flags: ['fresh', 'official_source'],
      },
      {
        source_name: 'IMD Coastal Weather',
        retrieved_at: '2026-09-15T06:00:00Z',
        metric_name: 'wind_speed',
        metric_value: 10.0,
        metric_unit: 'knots',
        quality_flags: ['fresh', 'official_source'],
      },
      {
        source_name: 'IMD Coastal Weather',
        retrieved_at: '2026-09-15T06:00:00Z',
        metric_name: 'visibility',
        metric_value: 12.0,
        metric_unit: 'km',
        quality_flags: ['fresh', 'official_source'],
      },
    ],
    map_layers: [],
    trace: [],
    warnings: [],
    suggested_followups: [],
  };

  const mockCautionResponse: ChatResponse = {
    ...mockSafeResponse,
    recommendation: {
      status: 'CAUTION',
      summary: 'Moderate wave conditions (1.9m waves, 16 kt wind) require operational caution for motorized boat.',
      decisive_factors: ['Moderate wave height 1.9m requires caution.'],
      next_action: 'Operate with caution within 5 nm of coastline.',
      threshold_comparisons: [
        {
          metric_name: 'significant_wave_height_m',
          observed_value: 1.9,
          threshold_value: 1.5,
          operator: '>=',
          unit: 'meters',
          exceeded: true,
          impact: 'CAUTION_TRIGGER',
          description: 'Moderate wave height requires caution.',
        },
        {
          metric_name: 'wind_speed_knots',
          observed_value: 16.0,
          threshold_value: 18.0,
          operator: '<',
          unit: 'knots',
          exceeded: false,
          impact: 'SAFE',
          description: 'Wind speed within range.',
        },
      ],
    },
  };

  const mockNoGoResponse: ChatResponse = {
    ...mockSafeResponse,
    recommendation: {
      status: 'NO_GO',
      summary: 'Departure advised against (NO-GO). Severe sea state with wave heights of 3.4m and active IMD squall alert.',
      decisive_factors: [
        'Significant wave height 3.4m exceeds safety ceiling (2.5m)',
        'Active IMD squall alert across coastal sector',
      ],
      next_action: 'Remain moored in port. Do not navigate under any circumstances.',
      threshold_comparisons: [
        {
          metric_name: 'significant_wave_height_m',
          observed_value: 3.4,
          threshold_value: 2.5,
          operator: '>',
          unit: 'meters',
          exceeded: true,
          impact: 'NO_GO_TRIGGER',
          description: 'Wave height 3.4m exceeds limit.',
        },
        {
          metric_name: 'squall_alert',
          observed_value: true,
          threshold_value: false,
          operator: '==',
          unit: 'boolean',
          exceeded: true,
          impact: 'NO_GO_TRIGGER',
          description: 'Active squall alert.',
        },
      ],
    },
  };

  const mockUnknownResponse: ChatResponse = {
    ...mockSafeResponse,
    recommendation: {
      status: 'UNKNOWN',
      summary: 'Sensor telemetry is stale or missing. Safe departure evaluation cannot be completed.',
      decisive_factors: ['Missing critical sensor telemetry.'],
      next_action: 'Hold departure and verify with port authorities.',
      threshold_comparisons: [
        {
          metric_name: 'data_validity',
          observed_value: 'EXPIRED',
          threshold_value: 'CURRENT_WINDOW',
          operator: '==',
          unit: 'status',
          exceeded: true,
          impact: 'UNKNOWN_TRIGGER',
          description: 'Telemetry expired.',
        },
      ],
    },
    evidence: [],
  };

  describe('Primary Decision State Resolution', () => {
    it('resolves UNKNOWN when no response exists (initial state)', () => {
      const status = getFisherDecisionStatus(null);
      expect(status).toBe('UNKNOWN');
      const explanation = getFisherExplanation(null, status, 'en');
      expect(explanation).toBe('No current safety assessment available.');
    });

    it('resolves SAFE_TO_GO when backend status is GO', () => {
      const status = getFisherDecisionStatus(mockSafeResponse);
      expect(status).toBe('SAFE_TO_GO');
      const explanation = getFisherExplanation(mockSafeResponse, status, 'en');
      expect(explanation).toContain('Conditions are calm and safe');
    });

    it('resolves CAUTION when backend status is CAUTION', () => {
      const status = getFisherDecisionStatus(mockCautionResponse);
      expect(status).toBe('CAUTION');
      const explanation = getFisherExplanation(mockCautionResponse, status, 'en');
      expect(explanation).toContain('Moderate wave conditions');
    });

    it('resolves DO_NOT_GO when backend status is NO_GO', () => {
      const status = getFisherDecisionStatus(mockNoGoResponse);
      expect(status).toBe('DO_NOT_GO');
      const explanation = getFisherExplanation(mockNoGoResponse, status, 'en');
      expect(explanation).toContain('Departure advised against (NO-GO)');
    });

    it('resolves UNKNOWN when backend reports UNKNOWN or degraded evidence', () => {
      const status = getFisherDecisionStatus(mockUnknownResponse);
      expect(status).toBe('UNKNOWN');
      const explanation = getFisherExplanation(mockUnknownResponse, status, 'en');
      expect(explanation).toContain('Sensor telemetry is stale or missing');
    });

    it('resolves UNKNOWN upon backend error and displays error message', () => {
      const status = getFisherDecisionStatus(null, 'Network connection failed');
      expect(status).toBe('UNKNOWN');
      const explanation = getFisherExplanation(null, status, 'en', 'Network connection failed');
      expect(explanation).toBe('Unable to obtain a current safety assessment.');
    });

    it('resolves explicit loading state without prematurely showing GO', () => {
      const status = getFisherDecisionStatus(null);
      expect(status).toBe('UNKNOWN');
      const explanation = getFisherExplanation(null, status, 'en', null, true);
      expect(explanation).toBe('Checking current marine conditions…');
    });
  });

  describe('Essential Local Conditions Extraction', () => {
    it('extracts waves, wind, visibility, and hazard from structured response', () => {
      const conds = extractFisherConditions(mockSafeResponse);
      expect(conds.waves).toBe('1.2 m');
      expect(conds.wind).toBe('10.0 kn');
      expect(conds.visibility).toBe('12.0 km');
      expect(conds.hazard).toBe('No Active Hazards');
    });

    it('extracts squall hazard correctly on severe conditions', () => {
      const conds = extractFisherConditions(mockNoGoResponse);
      expect(conds.waves).toBe('3.4 m');
      expect(conds.hazard).toBe('Squall Alert');
    });

    it('preserves missing values as "—" and never coerces to 0', () => {
      const conds = extractFisherConditions(mockUnknownResponse);
      expect(conds.waves).toBe('—');
      expect(conds.wind).toBe('—');
      expect(conds.visibility).toBe('—');
      expect(conds.waves).not.toBe('0 m');
      expect(conds.waves).not.toBe('0');
      expect(conds.wind).not.toBe('0 kn');
    });

    it('preserves empty response conditions as all "—"', () => {
      const conds = extractFisherConditions(null);
      expect(conds.waves).toBe('—');
      expect(conds.wind).toBe('—');
      expect(conds.visibility).toBe('—');
      expect(conds.hazard).toBe('—');
    });
  });

  describe('Harbor Layer Initial Neutrality', () => {
    it('creates neutral harbor layer when status is UNKNOWN (never implies GO)', () => {
      const layer = createHarborLayer('Ratnagiri', 'UNKNOWN');
      expect(layer.style?.color).toBe('#64748b'); // Neutral slate
      expect(layer.geojson.properties.operational_status).toBe('UNKNOWN');
    });

    it('defaults createHarborLayer to UNKNOWN color when called without explicit status', () => {
      const layer = createHarborLayer('Ratnagiri');
      expect(layer.style?.color).toBe('#64748b');
      expect(layer.geojson.properties.operational_status).toBe('UNKNOWN');
    });

    it('updates harbor layer color when active recommendation arrives', () => {
      const safeLayer = createHarborLayer('Ratnagiri', 'GO');
      expect(safeLayer.style?.color).toBe('#0ea5e9');

      const noGoLayer = createHarborLayer('Ratnagiri', 'NO_GO');
      expect(noGoLayer.style?.color).toBe('#ef4444');

      const cautionLayer = createHarborLayer('Ratnagiri', 'CAUTION');
      expect(cautionLayer.style?.color).toBe('#eab308');
    });
  });

  describe('Data Mode Disclosure & Component Integrity', () => {
    it('exports FisherDecisionSurface component cleanly', () => {
      expect(FisherDecisionSurface).toBeDefined();
      expect(typeof FisherDecisionSurface).toBe('function');
    });

    it('reused the canonical DATA MODE constants without discrepancy', () => {
      expect(CANONICAL_DATA_MODE_LABEL).toBe('DATA MODE: SYNTHETIC DEMO / SNAPSHOT');
      expect(CANONICAL_DATA_MODE_TOOLTIP).toContain('Deterministic synthetic data modeled on documented');
    });
  });
});
