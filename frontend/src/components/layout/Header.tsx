import LanguageSelector from './LanguageSelector';
import DataModeIndicator from './DataModeIndicator';
import { FileText } from 'lucide-react';

interface HeaderProps {
  language: 'en' | 'hi' | 'mr';
  onLanguageChange: (lang: 'en' | 'hi' | 'mr') => void;
  evidenceCount: number;
  onOpenEvidence: () => void;
}

export default function Header({
  language,
  onLanguageChange,
  evidenceCount,
  onOpenEvidence,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <h1 className="app-title">
          SAMUDRA{' '}
          <span className="app-subtitle">| SIH 2026 PS 26176 (ISRO)</span>
        </h1>
        <p className="app-tagline">
          Smart Autonomous Marine Understanding, Decision &amp; Risk Assistant
        </p>
      </div>

      <div className="app-header-right">
        <LanguageSelector language={language} onChange={onLanguageChange} />
        <DataModeIndicator mode="HYBRID" />
        {evidenceCount > 0 && (
          <button
            className="evidence-toggle-btn"
            onClick={onOpenEvidence}
            aria-label={`Open evidence drawer with ${evidenceCount} items`}
          >
            <FileText size={14} />
            <span>Evidence ({evidenceCount})</span>
          </button>
        )}
      </div>
    </header>
  );
}
