import { describe, it, expect } from 'vitest';
import { TRANSLATIONS, translateText, translateChatMessage } from './translations';
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
    expect(t.back).toBeTruthy();
    expect(t.backToStart).toBeTruthy();
    expect(t.newChat).toBeTruthy();
    expect(t.chatTitle).toBeTruthy();

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

  it('translates chat message content across languages', () => {
    const enQuery = 'Where is the nearest Potential Fishing Zone today from Ratnagiri?';
    const mrQuery = translateChatMessage(enQuery, 'mr');
    const hiQuery = translateChatMessage(enQuery, 'hi');

    expect(mrQuery).toContain('मत्स्य');
    expect(hiQuery).toContain('मत्स्य');

    const enAnswer = 'Departure from Ratnagiri tomorrow at 06:00 is advised against (NO-GO).';
    expect(translateChatMessage(enAnswer, 'mr')).toContain('रत्नागिरी');
    expect(translateChatMessage(enAnswer, 'hi')).toContain('रत्नागिरी');
  });

  it('translates recommendation factors and next actions', () => {
    const decisive = 'Significant wave height 3.4m exceeds craft safety ceiling (2.5m)';
    expect(translateText(decisive, 'hi')).toContain('लहर ऊंचाई 3.4 मी');
    expect(translateText(decisive, 'mr')).toContain('लाट उंची 3.4 मी');
  });
});
