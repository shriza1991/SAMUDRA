import LanguageSelector from './LanguageSelector';
import DataModeIndicator from './DataModeIndicator';
import { FileText } from 'lucide-react';
import { TRANSLATIONS, type SupportedLanguage } from '../../i18n/translations';

interface HeaderProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  evidenceCount: number;
  onOpenEvidence: () => void;
}

export default function Header({
  language,
  onLanguageChange,
  evidenceCount,
  onOpenEvidence,
}: HeaderProps) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <header className="app-header">
      <div className="app-header-left">
        <h1 className="app-title">
          SAMUDRA{' '}
          <span className="app-subtitle">| SIH 2026 PS 26176 (ISRO)</span>
        </h1>
        <p className="app-tagline">
          {t.appTagline}
        </p>
      </div>

      <div className="app-header-right">
        <LanguageSelector language={language} onChange={onLanguageChange} />
        <DataModeIndicator />
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
