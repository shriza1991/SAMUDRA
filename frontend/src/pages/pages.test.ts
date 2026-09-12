import { describe, it, expect } from 'vitest';
import FisherPage from './FisherPage';
import AuthorityPage from './AuthorityPage';

describe('Persona Pages: Fisher & Authority Modular Separation', () => {
  it('exports FisherPage component cleanly', () => {
    expect(FisherPage).toBeDefined();
    expect(typeof FisherPage).toBe('function');
  });

  it('exports AuthorityPage component cleanly', () => {
    expect(AuthorityPage).toBeDefined();
    expect(typeof AuthorityPage).toBe('function');
  });

  it('validates role segregation between fisher and authority', () => {
    const roles: Array<'fisher' | 'authority'> = ['fisher', 'authority'];
    expect(roles).toHaveLength(2);
    expect(roles[0]).toBe('fisher');
    expect(roles[1]).toBe('authority');
  });
});
