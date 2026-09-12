import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  language: 'en' | 'hi' | 'mr';
  onChange: (lang: 'en' | 'hi' | 'mr') => void;
  className?: string;
}

const LANGUAGES = [
  { code: 'en' as const, label: 'English' },
  { code: 'hi' as const, label: 'हिंदी' },
  { code: 'mr' as const, label: 'मराठी' },
];

export default function LanguageSelector({ language, onChange, className }: LanguageSelectorProps) {
  return (
    <div
      className={cn('language-selector flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 p-0.5', className)}
      role="group"
      aria-label="Language selection"
    >
      <Globe size={13} className="lang-icon ml-1.5 text-muted-foreground" />
      <div className="lang-options flex items-center gap-0.5">
        {LANGUAGES.map((lang) => {
          const isActive = language === lang.code;
          return (
            <Button
              key={lang.code}
              type="button"
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'lang-btn h-6 px-2 text-xs font-medium transition-colors',
                isActive ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onChange(lang.code)}
              aria-pressed={isActive}
            >
              {lang.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
