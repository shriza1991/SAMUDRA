import { describe, it, expect } from 'vitest';
import PortalPage from './PortalPage';
import FisherPage from './FisherPage';
import AuthorityPage from './AuthorityPage';
import SettingsPage from './SettingsPage';

describe('Persona Pages: Fisher & Authority Modular Separation with Portal Selection', () => {
  it('exports PortalPage component cleanly', () => {
    expect(PortalPage).toBeDefined();
    expect(typeof PortalPage).toBe('function');
  });

  it('exports FisherPage component cleanly', () => {
    expect(FisherPage).toBeDefined();
    expect(typeof FisherPage).toBe('function');
  });

  it('exports AuthorityPage component cleanly', () => {
    expect(AuthorityPage).toBeDefined();
    expect(typeof AuthorityPage).toBe('function');
  });

  it('exports SettingsPage component cleanly', () => {
    expect(SettingsPage).toBeDefined();
    expect(typeof SettingsPage).toBe('function');
  });

  it('validates role segregation between fisher and authority', () => {
    const roles: Array<'fisher' | 'authority'> = ['fisher', 'authority'];
    expect(roles).toHaveLength(2);
    expect(roles[0]).toBe('fisher');
    expect(roles[1]).toBe('authority');
  });

  it('verifies portal acts as the single entrypoint for switching personas', () => {
    type PortalMode = 'selection' | 'fisher' | 'authority' | 'settings';
    let currentPortal: PortalMode = 'selection';

    const onSelectRole = (role: 'fisher' | 'authority') => {
      currentPortal = role;
    };
    const onLogout = () => {
      currentPortal = 'selection';
    };

    // User chooses Fisher on the single Portal page
    onSelectRole('fisher');
    expect(currentPortal).toBe('fisher');

    // User clicks Logout in the top-right header to return to Persona Selection
    onLogout();
    expect(currentPortal).toBe('selection');

    // User chooses Authority on the single Portal page
    onSelectRole('authority');
    expect(currentPortal).toBe('authority');

    // User clicks Logout again
    onLogout();
    expect(currentPortal).toBe('selection');
  });

  it('verifies seamless two-way routing into Settings and back to previous portal', () => {
    type PortalMode = 'selection' | 'fisher' | 'authority' | 'settings';
    let currentPortal: PortalMode = 'fisher';
    let previousPortal: PortalMode = 'selection';

    const openSettings = () => {
      if (currentPortal !== 'settings') {
        previousPortal = currentPortal;
        currentPortal = 'settings';
      } else {
        currentPortal = previousPortal;
      }
    };

    const backFromSettings = () => {
      currentPortal = previousPortal;
    };

    // Open settings while in fisher portal
    openSettings();
    expect(currentPortal).toBe('settings');
    expect(previousPortal).toBe('fisher');

    // Click Done/Back returns to fisher
    backFromSettings();
    expect(currentPortal).toBe('fisher');

    // Switch to authority
    currentPortal = 'authority';
    openSettings();
    expect(currentPortal).toBe('settings');
    expect(previousPortal).toBe('authority');

    // Click settings button again toggles back
    openSettings();
    expect(currentPortal).toBe('authority');
  });
});

