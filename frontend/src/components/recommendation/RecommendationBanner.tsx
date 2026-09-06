import type { Recommendation, Confidence } from '../../types/contracts';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { TRANSLATIONS, translateText, type SupportedLanguage } from '../../i18n/translations';

interface RecommendationBannerProps {
  recommendation: Recommendation;
  confidence?: Confidence;
  warnings?: string[];
  language?: SupportedLanguage;
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
}: RecommendationBannerProps) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const normalizedStatus = (recommendation.status || 'UNKNOWN').toUpperCase();

  const Icon = STATUS_ICONS[normalizedStatus] || Info;
  const statusClass = STATUS_CLASSES[normalizedStatus] || 'status-informational';
  const statusLabel = t.statusLabels[normalizedStatus] || recommendation.status || 'Advisory';

  const rawConf = confidence?.level?.toUpperCase() || 'MEDIUM';
  const confLabel = t.confidenceLabels[rawConf] || `${rawConf} Confidence`;

  return (
    <div className={`recommendation-banner ${statusClass}`}>
      <div className="recommendation-header">
        <div className="recommendation-status">
          <Icon size={20} />
          <span className="recommendation-label">{statusLabel}</span>
        </div>
        {confidence && (
          <span className={`confidence-badge confidence-${rawConf.toLowerCase()}`}>
            {confLabel}
          </span>
        )}
      </div>

      {recommendation.summary && (
        <p className="recommendation-summary">{translateText(recommendation.summary, language)}</p>
      )}

      {recommendation.decisive_factors && recommendation.decisive_factors.length > 0 && (
        <div className="decisive-factors">
          <h5 className="factors-title">{t.decisiveFactorsTitle}</h5>
          <ul className="factors-list">
            {recommendation.decisive_factors.map((factor, i) => (
              <li key={i} className="factor-item">
                <ChevronRight size={12} />
                <span>{translateText(factor, language)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendation.next_action && (
        <div className="next-action">
          <strong>{t.nextActionLabel}:</strong> {translateText(recommendation.next_action, language)}
        </div>
      )}

      {confidence?.reasons && confidence.reasons.length > 0 && (
        <div className="confidence-reasons">
          {confidence.reasons.map((reason, i) => (
            <span key={i} className="confidence-reason">{translateText(reason, language)}</span>
          ))}
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="banner-warnings" style={{ marginTop: '8px' }}>
          <h6 style={{ margin: '0 0 4px', fontSize: '11px', color: '#f59e0b', textTransform: 'uppercase' }}>
            {t.warningsTitle}
          </h6>
          {warnings.map((warn, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f59e0b' }}>
              <AlertTriangle size={12} />
              <span>{translateText(warn, language)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
