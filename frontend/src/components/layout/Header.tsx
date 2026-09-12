import LanguageSelector from './LanguageSelector';
import DataModeIndicator from './DataModeIndicator';
import ThemeToggle from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, LogOut, PhoneCall } from 'lucide-react';
import { TRANSLATIONS, type SupportedLanguage } from '../../i18n/translations';
import { cn } from '@/lib/utils';

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
  className?: string;
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
  className,
}: HeaderProps) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const handleLogout = onLogout || onReturnToPortal;

  return (
    <header className={cn('app-header flex items-center justify-between border-b border-border bg-card/90 px-4 py-2 backdrop-blur-md', className)}>
      <div className="app-header-left flex items-center gap-3">
        <h1 className="app-title text-base font-bold tracking-tight text-foreground sm:text-lg">SAMUDRA</h1>
        <p className="app-tagline hidden text-xs text-muted-foreground md:inline">
          {t.appTagline}
        </p>
      </div>

      <div className="app-header-right flex items-center gap-2">
        {onStartCall && currentPortal === 'fisher' && (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="call-samudra-trigger-btn relative gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            onClick={onStartCall}
            title={t.callSamudraBtn}
            aria-label={t.callSamudraBtn}
          >
            <span className="call-trigger-pulse-dot size-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
            <PhoneCall size={13} />
            <span className="text-xs font-semibold">{t.callSamudraBtn}</span>
          </Button>
        )}
        <LanguageSelector language={language} onChange={onLanguageChange} />
        <DataModeIndicator />
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        {evidenceCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="evidence-toggle-btn gap-1.5 px-2.5 text-xs font-medium"
            onClick={onOpenEvidence}
            aria-label={`${t.evidenceBtn} (${evidenceCount})`}
          >
            <FileText size={13} className="text-primary" />
            <span>{t.evidenceBtn}</span>
            <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px] font-bold">
              {evidenceCount}
            </Badge>
          </Button>
        )}
        {currentPortal !== 'selection' && handleLogout && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="header-logout-btn gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            title={t.logoutBtn || 'Logout'}
            aria-label={t.logoutBtn || 'Logout'}
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">{t.logoutBtn || 'Logout'}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
