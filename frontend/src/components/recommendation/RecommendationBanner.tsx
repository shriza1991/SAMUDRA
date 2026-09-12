import type { Recommendation, Confidence } from '../../types/contracts';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { TRANSLATIONS, translateText, type SupportedLanguage } from '../../i18n/translations';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RecommendationBannerProps {
  recommendation: Recommendation;
  confidence?: Confidence;
  warnings?: string[];
  language?: SupportedLanguage;
  className?: string;
}

const STATUS_ICONS: Record<string, any> = {
  GO: ShieldCheck,
  CAUTION: ShieldAlert,
  NO_GO: ShieldX,
  UNKNOWN: ShieldQuestion,
  INFORMATIONAL: Info,
};

const STATUS_CLASSES: Record<string, string> = {
  GO: 'status-go',
  CAUTION: 'status-caution',
  NO_GO: 'status-no-go',
  UNKNOWN: 'status-unknown',
  INFORMATIONAL: 'status-informational',
};

export default function RecommendationBanner({
  recommendation,
  confidence,
  warnings,
  language = 'en',
  className,
}: RecommendationBannerProps) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const normalizedStatus = (recommendation.status || 'UNKNOWN').toUpperCase();

  const Icon = STATUS_ICONS[normalizedStatus] || Info;
  const statusClass = STATUS_CLASSES[normalizedStatus] || 'status-informational';
  const statusLabel = t.statusLabels[normalizedStatus] || recommendation.status || 'Advisory';

  const rawConf = confidence?.level?.toUpperCase() || 'MEDIUM';
  const confLabel = t.confidenceLabels[rawConf] || `${rawConf} Confidence`;

  const getStatusBadgeVariant = (): 'go' | 'caution' | 'noGo' | 'unknown' | 'secondary' => {
    switch (normalizedStatus) {
      case 'GO':
        return 'go';
      case 'CAUTION':
        return 'caution';
      case 'NO_GO':
        return 'noGo';
      case 'UNKNOWN':
        return 'unknown';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className={cn('recommendation-banner overflow-hidden border-2 shadow-sm', statusClass, className)}>
      <CardHeader className="p-3.5 pb-2">
        <div className="recommendation-header flex items-center justify-between gap-2">
          <div className="recommendation-status flex items-center gap-2 font-bold text-sm sm:text-base">
            <Icon size={20} className="shrink-0" />
            <span className="recommendation-label tracking-tight">{statusLabel}</span>
            <Badge variant={getStatusBadgeVariant()} className="text-[10px] uppercase font-bold tracking-wider">
              {normalizedStatus}
            </Badge>
          </div>
          {confidence && (
            <Badge variant="outline" className={`confidence-badge confidence-${rawConf.toLowerCase()} text-[11px] font-semibold`}>
              {confLabel}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3.5 pt-0 space-y-3">
        {recommendation.summary && (
          <p className="recommendation-summary text-xs sm:text-sm font-medium leading-relaxed">
            {translateText(recommendation.summary, language)}
          </p>
        )}

        {recommendation.decisive_factors && recommendation.decisive_factors.length > 0 && (
          <div className="decisive-factors space-y-1 rounded-md bg-background/50 p-2.5 border border-border/50">
            <h5 className="factors-title text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t.decisiveFactorsTitle}
            </h5>
            <ul className="factors-list space-y-1 pt-1">
              {recommendation.decisive_factors.map((factor, i) => (
                <li key={i} className="factor-item flex items-start gap-1.5 text-xs">
                  <ChevronRight size={13} className="mt-0.5 shrink-0 text-primary" />
                  <span>{translateText(factor, language)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recommendation.threshold_comparisons && recommendation.threshold_comparisons.length > 0 && (
          <div className="threshold-checks rounded-md bg-background/50 p-2.5 border border-border/50 space-y-1.5">
            <h6 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Deterministic Threshold Verification
            </h6>
            <div className="flex flex-col gap-1">
              {recommendation.threshold_comparisons.map((tc, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-foreground/90 font-medium">{tc.description || tc.metric_name}</span>
                  <Badge
                    variant={
                      tc.impact === 'NO_GO_TRIGGER'
                        ? 'noGo'
                        : tc.impact === 'CAUTION_TRIGGER'
                        ? 'caution'
                        : tc.impact === 'UNKNOWN_TRIGGER'
                        ? 'unknown'
                        : 'go'
                    }
                    className="h-4 px-1.5 text-[10px]"
                  >
                    {tc.impact.replace('_TRIGGER', '')}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendation.non_decisive_factors && recommendation.non_decisive_factors.length > 0 && (
          <div className="non-decisive-factors text-xs text-muted-foreground">
            <ul className="list-disc pl-4 space-y-0.5">
              {recommendation.non_decisive_factors.map((factor, i) => (
                <li key={i}>{translateText(factor, language)}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendation.next_action && (
          <div className="next-action rounded-md bg-primary/10 p-2.5 text-xs text-foreground border border-primary/20">
            <strong className="font-semibold text-primary">{t.nextActionLabel}:</strong>{' '}
            {translateText(recommendation.next_action, language)}
          </div>
        )}

        {recommendation.provenance && recommendation.provenance.length > 0 && (
          <div className="data-provenance flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
            {recommendation.provenance.map((prov, i) => (
              <Badge key={i} variant="outline" className="text-[10px] text-muted-foreground font-normal">
                {prov.provider_name} • {prov.source_name} {prov.valid_to ? `(Valid to ${prov.valid_to.slice(0, 16).replace('T', ' ')} UTC)` : ''}
              </Badge>
            ))}
          </div>
        )}

        {confidence?.reasons && confidence.reasons.length > 0 && (
          <div className="confidence-reasons flex flex-wrap gap-1 pt-1">
            {confidence.reasons.map((reason, i) => (
              <span key={i} className="confidence-reason text-[11px] text-muted-foreground">
                • {translateText(reason, language)}
              </span>
            ))}
          </div>
        )}

        {((warnings && warnings.length > 0) || (recommendation.warnings && recommendation.warnings.length > 0)) && (
          <div className="banner-warnings rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400 border border-amber-500/20 space-y-1">
            <h6 className="text-[10px] font-bold uppercase tracking-wider">
              {t.warningsTitle}
            </h6>
            {(warnings || recommendation.warnings || []).map((warn, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <AlertTriangle size={12} className="shrink-0" />
                <span>{translateText(warn, language)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
