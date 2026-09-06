
import type { Recommendation, Confidence } from '../../types/contracts';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Info, ChevronRight } from 'lucide-react';

interface RecommendationBannerProps {
  recommendation: Recommendation;
  confidence: Confidence;
}

const STATUS_CONFIG = {
  GO: {
    icon: ShieldCheck,
    label: 'GO — Safe to Proceed',
    className: 'status-go',
  },
  CAUTION: {
    icon: ShieldAlert,
    label: 'CAUTION — Elevated Risk',
    className: 'status-caution',
  },
  NO_GO: {
    icon: ShieldX,
    label: 'NO-GO — Unsafe',
    className: 'status-no-go',
  },
  UNKNOWN: {
    icon: ShieldQuestion,
    label: 'UNKNOWN — Insufficient Data',
    className: 'status-unknown',
  },
  INFORMATIONAL: {
    icon: Info,
    label: 'INFORMATIONAL',
    className: 'status-informational',
  },
};

export default function RecommendationBanner({ recommendation, confidence }: RecommendationBannerProps) {
  const config = STATUS_CONFIG[recommendation.status];
  const Icon = config.icon;

  return (
    <div className={`recommendation-banner ${config.className}`}>
      <div className="recommendation-header">
        <div className="recommendation-status">
          <Icon size={20} />
          <span className="recommendation-label">{config.label}</span>
        </div>
        <span className={`confidence-badge confidence-${confidence.level.toLowerCase()}`}>
          {confidence.level} confidence
        </span>
      </div>

      <p className="recommendation-summary">{recommendation.summary}</p>

      {recommendation.decisive_factors.length > 0 && (
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
          <strong>Next:</strong> {recommendation.next_action}
        </div>
      )}

      {confidence.reasons.length > 0 && (
        <div className="confidence-reasons">
          {confidence.reasons.map((reason, i) => (
            <span key={i} className="confidence-reason">{reason}</span>
          ))}
        </div>
      )}
    </div>
  );
}
