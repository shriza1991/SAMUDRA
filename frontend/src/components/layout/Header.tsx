import LanguageSelector from './LanguageSelector';
import DataModeIndicator from './DataModeIndicator';
import ThemeToggle from './ThemeToggle';
import { ArrowLeft, FileText, PhoneCall } from 'lucide-react';
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
  onReturnToPortal,
}: HeaderProps) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-title-group">
          <h1 className="app-title">SAMUDRA</h1>
          {onReturnToPortal && currentPortal !== 'selection' && (
            <button
              type="button"
              className="header-back-portal-btn"
              onClick={onReturnToPortal}
              title="Return to Portal Selection"
            >
              <ArrowLeft size={13} />
              <span>Change Portal</span>
            </button>
          )}
        </div>
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
      </div>
    </header>
  );
}
