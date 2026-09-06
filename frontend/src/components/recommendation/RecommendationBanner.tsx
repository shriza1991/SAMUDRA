import type { Recommendation, Confidence } from '../../types/contracts';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Info, ChevronRight, AlertTriangle } from 'lucide-react';

interface RecommendationBannerProps {
  recommendation: Recommendation;
  confidence?: Confidence;
  warnings?: string[];
}

const STATUS_CONFIG: Record<string, { icon: any; label: string; className: string }> = {
  GO: {
    icon: ShieldCheck,
    label: 'GO — Favorable / Safe',
    className: 'status-go',
  },
  CAUTION: {
    icon: ShieldAlert,
    label: 'CAUTION — Elevated Marine Risk',
    className: 'status-caution',
  },
  NO_GO: {
    icon: ShieldX,
    label: 'NO-GO — Hazardous Departure Advised Against',
    className: 'status-no-go',
  },
  UNKNOWN: {
    icon: ShieldQuestion,
    label: 'UNKNOWN — Missing or Stale Critical Data',
    className: 'status-unknown',
  },
  INFORMATIONAL: {
    icon: Info,
    label: 'INFORMATIONAL',
    className: 'status-informational',
  },
};

export default function RecommendationBanner({
  recommendation,
  confidence,
  warnings,
}: RecommendationBannerProps) {
  const normalizedStatus = (recommendation.status || 'UNKNOWN').toUpperCase();
  const config = STATUS_CONFIG[normalizedStatus] || {
    icon: Info,
    label: recommendation.status || 'Advisory',
    className: 'status-informational',
  };
  const Icon = config.icon;

  const confLevel = confidence?.level?.toUpperCase() || 'MEDIUM';

  return (
    <div className={`recommendation-banner ${config.className}`}>
      <div className="recommendation-header">
        <div className="recommendation-status">
          <Icon size={20} />
          <span className="recommendation-label">{config.label}</span>
        </div>
        {confidence && (
          <span className={`confidence-badge confidence-${confLevel.toLowerCase()}`}>
            {confLevel} confidence
          </span>
        )}
      </div>

      {recommendation.summary && (
        <p className="recommendation-summary">{recommendation.summary}</p>
      )}

      {recommendation.decisive_factors && recommendation.decisive_factors.length > 0 && (
        <div className="decisive-factors">
          <h5 className="factors-title">Decisive Factors</h5>
          <ul className="factors-list">
            {recommendation.decisive_factors.map((factor, i) => (
              <li key={i} className="factor-item">
                <ChevronRight size={12} />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendation.next_action && (
        <div className="next-action">
          <strong>Recommended Next Action:</strong> {recommendation.next_action}
        </div>
      )}

      {confidence?.reasons && confidence.reasons.length > 0 && (
        <div className="confidence-reasons">
          {confidence.reasons.map((reason, i) => (
            <span key={i} className="confidence-reason">{reason}</span>
          ))}
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="banner-warnings" style={{ marginTop: '8px' }}>
          {warnings.map((warn, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f59e0b' }}>
              <AlertTriangle size={12} />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
