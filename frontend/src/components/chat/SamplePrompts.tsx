import { useEffect, useState } from 'react';
import { getDemoScenarios, type DemoScenario } from '../../api/client';
import { TRANSLATIONS, type SupportedLanguage, type PromptTemplate } from '../../i18n/translations';
import { Compass, ShieldAlert, Navigation, Fish } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SamplePromptsProps {
  language: SupportedLanguage;
  onSelect: (query: string) => void;
  disabled?: boolean;
  className?: string;
}

const ICON_MAP: Record<string, any> = {
  pfz: Fish,
  safety: ShieldAlert,
  hazard: Compass,
  route: Navigation,
};

export default function SamplePrompts({ language, onSelect, disabled, className }: SamplePromptsProps) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [prompts, setPrompts] = useState<PromptTemplate[]>(t.prompts);

  useEffect(() => {
    setPrompts(t.prompts);
  }, [language, t]);

  useEffect(() => {
    let isMounted = true;
    getDemoScenarios()
      .then((scenarios: DemoScenario[]) => {
        if (!isMounted || !scenarios || scenarios.length === 0) return;
        if (language === 'en') {
          const dynamicPrompts: PromptTemplate[] = scenarios.map((s) => ({
            id: s.id,
            label: s.name,
            query: s.query || (
              s.intent === 'NEAREST_PFZ'
                ? `Where is the nearest Potential Fishing Zone today? (${s.name})`
                : s.intent === 'HAZARD_BOUNDARY'
                ? `Check hazards and restricted water zones (${s.name})`
                : s.intent === 'SAFER_ROUTE'
                ? `Which alternative route is safer? (${s.name})`
                : `Is it safe to depart? (${s.name})`
            ),
          }));
          setPrompts(dynamicPrompts);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [language]);

  return (
    <div className={cn('sample-prompts mt-4 w-full space-y-2.5', className)}>
      <h4 className="sample-prompts-title text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t.samplePromptsTitle}
      </h4>
      <div className="sample-prompts-grid grid grid-cols-1 gap-2 sm:grid-cols-2">
        {prompts.map((item) => {
          const Icon = ICON_MAP[item.id] || Compass;
          return (
            <Card
              key={item.id}
              className={cn(
                'sample-prompt-btn group relative border-border/80 bg-card/60 p-3 text-left transition-all',
                disabled
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'cursor-pointer hover:border-primary/40 hover:bg-card hover:shadow-xs'
              )}
              onClick={disabled ? undefined : () => onSelect(item.query)}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(item.query);
                }
              }}
              aria-label={`Prompt: ${item.query}`}
            >
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon size={13} />
                </div>
                <span className="sample-prompt-label text-xs font-semibold text-foreground">
                  {item.label}
                </span>
              </div>
              <p className="sample-prompt-text mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-snug group-hover:text-foreground/90">
                {item.query}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
