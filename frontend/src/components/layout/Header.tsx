import LanguageSelector from './LanguageSelector';
import DataModeIndicator from './DataModeIndicator';
import ThemeToggle from './ThemeToggle';
import { FileText, LogOut, PhoneCall } from 'lucide-react';
import { TRANSLATIONS, type SupportedLanguage } from '../../i18n/translations';

interface HeaderProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  evidenceCount: number;
  onOpenEvidence: () => void;
  onStartCall?: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  currentPortal?: 'selection' | 'fisher' | 'authority';
  onLogout?: () => void;
  onReturnToPortal?: () => void;
}

export default function Header({
  language,
  onLanguageChange,
  evidenceCount,
  onOpenEvidence,
  onStartCall,
  theme,
  onThemeToggle,
  currentPortal = 'selection',
  onLogout,
  onReturnToPortal,
}: HeaderProps) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const handleLogout = onLogout || onReturnToPortal;

  return (
    <header className="app-header">
      <div className="app-header-left">
        <h1 className="app-title">SAMUDRA</h1>
        <p className="app-tagline">
          {t.appTagline}
        </p>
      </div>

      <div className="app-header-right">
        {onStartCall && currentPortal === 'fisher' && (
          <button
            type="button"
            className="call-samudra-trigger-btn"
            onClick={onStartCall}
            title={t.callSamudraBtn}
            aria-label={t.callSamudraBtn}
          >
            <span className="call-trigger-pulse-dot" aria-hidden="true" />
            <PhoneCall size={14} />
            <span>{t.callSamudraBtn}</span>
          </button>
        )}
        <LanguageSelector language={language} onChange={onLanguageChange} />
        <DataModeIndicator />
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        {evidenceCount > 0 && (
          <button
            className="evidence-toggle-btn"
            onClick={onOpenEvidence}
            aria-label={`${t.evidenceBtn} (${evidenceCount})`}
          >
            <FileText size={14} />
            <span>{t.evidenceBtn} ({evidenceCount})</span>
          </button>
        )}
        {currentPortal !== 'selection' && handleLogout && (
          <button
            type="button"
            className="header-logout-btn"
            onClick={handleLogout}
            title={t.logoutBtn || 'Logout'}
            aria-label={t.logoutBtn || 'Logout'}
          >
            <LogOut size={14} />
            <span>{t.logoutBtn || 'Logout'}</span>
          </button>
        )}
      </div>
    </header>
  );
}
