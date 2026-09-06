import { describe, it, expect } from 'vitest';
import { TRANSLATIONS } from './translations';
import type { SupportedLanguage } from './translations';

describe('Multilingual i18n Dictionary', () => {
  const languages: SupportedLanguage[] = ['en', 'hi', 'mr'];

  it.each(languages)('provides complete translation keys for %s', (lang) => {
    const t = TRANSLATIONS[lang];
    expect(t).toBeDefined();
    expect(t.appTagline).toBeTruthy();
    expect(t.welcomeTitle).toBeTruthy();
    expect(t.welcomeSubtitle).toBeTruthy();
    expect(t.inputPlaceholder).toBeTruthy();
    expect(t.samplePromptsTitle).toBeTruthy();
    expect(t.decisiveFactorsTitle).toBeTruthy();
    expect(t.nextActionLabel).toBeTruthy();

    // Check all standard recommendation statuses have localized labels
    const expectedStatuses = ['GO', 'CAUTION', 'NO_GO', 'UNKNOWN', 'INFORMATIONAL'];
    for (const status of expectedStatuses) {
      expect(t.statusLabels[status]).toBeDefined();
      expect(t.statusLabels[status].length).toBeGreaterThan(0);
    }

    // Check canonical prompt queries exist in that specific script
    expect(t.prompts).toHaveLength(4);
    for (const p of t.prompts) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.query).toBeTruthy();
    }
  });

  it('Marathi prompts contain Devanagari characters', () => {
    const mr = TRANSLATIONS.mr;
    expect(/[\u0900-\u097F]/.test(mr.welcomeTitle)).toBe(true);
    expect(/[\u0900-\u097F]/.test(mr.prompts[0].query)).toBe(true);
    expect(mr.prompts.some(p => p.query.includes('रत्नागिरी'))).toBe(true);
  });

  it('Hindi prompts contain Devanagari characters', () => {
    const hi = TRANSLATIONS.hi;
    expect(/[\u0900-\u097F]/.test(hi.welcomeTitle)).toBe(true);
    expect(/[\u0900-\u097F]/.test(hi.prompts[0].query)).toBe(true);
    expect(hi.prompts.some(p => p.query.includes('रत्नागिरी'))).toBe(true);
  });
});
