import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WHAT_IF_PARAMS,
  type DecisionDiff,
} from '../../types/mission';

describe('Mission Twin What-If Simulator Contract & Logic', () => {
  it('validates default what-if simulation parameters', () => {
    expect(DEFAULT_WHAT_IF_PARAMS.timeOffsetHours).toBe(4);
    expect(DEFAULT_WHAT_IF_PARAMS.craftProfileOverride).toBe('motorized_boat');
    expect(DEFAULT_WHAT_IF_PARAMS.objective).toBe('pfz');
  });

  it('generates correct counterfactual queries in English', () => {
    const harbor = 'Ratnagiri';
    const craft = 'Mechanized trawler';
    const offset = 4;
    const query = `What if I delay departure from ${harbor} by ${offset} hours with a ${craft}?`;

    expect(query).toContain('Ratnagiri');
    expect(query).toContain('4 hours');
    expect(query).toContain('Mechanized trawler');
  });

  it('generates correct counterfactual queries in Hindi and Marathi', () => {
    const harbor = 'Ratnagiri';
    const craft = 'Motorized boat';
    const offset = 2;

    const hiQuery = `यदि मैं ${harbor} से प्रस्थान ${offset} घंटे विलंबित करूँ (${craft}), तो क्या स्थिति अनुकूल होगी?`;
    const mrQuery = `जर मी ${harbor} वरून प्रस्थान ${offset} तास पुढे ढकलले (${craft}), तर स्थिती कशी असेल?`;

    expect(hiQuery).toContain('घंटे विलंबित');
    expect(mrQuery).toContain('तास पुढे');
  });

  it('computes and validates Decision Diff structure', () => {
    const diff: DecisionDiff = {
      baselineStatus: 'NO_GO',
      simulatedStatus: 'CAUTION',
      summary: 'Wave height abates from 3.2m to 1.8m after a 4-hour delay.',
      timeOffsetHours: 4,
      craftProfile: 'motorized_boat',
      timestamp: new Date().toISOString(),
    };

    expect(diff.baselineStatus).toBe('NO_GO');
    expect(diff.simulatedStatus).toBe('CAUTION');
    expect(diff.timeOffsetHours).toBe(4);
    expect(diff.summary).toContain('1.8m');
  });

  it('handles unchanged decision status in Decision Diff', () => {
    const diff: DecisionDiff = {
      baselineStatus: 'NO_GO',
      simulatedStatus: 'NO_GO',
      summary: 'Squall warning remains active along the coast.',
      timeOffsetHours: 2,
      craftProfile: 'traditional_non_motorized',
      timestamp: new Date().toISOString(),
    };

    expect(diff.baselineStatus).toBe(diff.simulatedStatus);
    expect(diff.craftProfile).toBe('traditional_non_motorized');
  });
});
