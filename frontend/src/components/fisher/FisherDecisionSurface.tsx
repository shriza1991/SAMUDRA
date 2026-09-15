import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  HelpCircle,
  Waves as WavesIcon,
  Wind as WindIcon,
  Eye,
  AlertTriangle,
  Loader2,
  Database,
  SlidersHorizontal,
} from 'lucide-react';
import type { ChatResponse } from '../../types/contracts';
import type { DecisionDiff, MissionContext } from '../../types/mission';
import { translateText, type SupportedLanguage } from '../../i18n/translations';
import {
  CANONICAL_DATA_MODE_LABEL,
  CANONICAL_DATA_MODE_TOOLTIP,
} from '../../api/researcher-client';

export type FisherDecisionStatus = 'SAFE_TO_GO' | 'CAUTION' | 'DO_NOT_GO' | 'UNKNOWN';

export interface FisherConditions {
  waves: string;
  wind: string;
  visibility: string;
  hazard: string;
}

export interface FisherDecisionSurfaceProps {
  activeResponse: ChatResponse | null;
  isLoading?: boolean;
  error?: string | null;
  activeDiff?: DecisionDiff | null;
  missionContext?: MissionContext;
  language?: SupportedLanguage;
  onOpenVoyageSettings?: () => void;
}

/**
 * Maps backend recommendation status to standardized fisherman verdict.
 * Never defaults missing or unknown evidence to GO.
 */
export function getFisherDecisionStatus(
  response: ChatResponse | null,
  error?: string | null
): FisherDecisionStatus {
  if (error || !response || !response.recommendation) {
    return 'UNKNOWN';
  }
  const rawStatus = (response.recommendation.status || '').toUpperCase();
  switch (rawStatus) {
    case 'GO':
      return 'SAFE_TO_GO';
    case 'CAUTION':
      return 'CAUTION';
    case 'NO_GO':
      return 'DO_NOT_GO';
    case 'UNKNOWN':
    case 'INFORMATIONAL':
    default:
      return 'UNKNOWN';
  }
}

/**
 * Returns a concise one-sentence operational explanation for mariners.
 * Builds on top of structured backend recommendation summary or decisive factors.
 */
export function getFisherExplanation(
  response: ChatResponse | null,
  status: FisherDecisionStatus,
  language: SupportedLanguage = 'en',
  error?: string | null,
  isLoading?: boolean
): string {
  if (isLoading) {
    return translateText('Checking current marine conditions…', language);
  }
  if (error) {
    return translateText('Unable to obtain a current safety assessment.', language);
  }
  if (!response || !response.recommendation) {
    return translateText('No current safety assessment available.', language);
  }

  const rec = response.recommendation;
  if (status === 'UNKNOWN') {
    if (rec.summary && rec.summary.trim().length > 0) {
      return translateText(rec.summary, language);
    }
    return translateText(
      'A safety recommendation is not available from the current evidence.',
      language
    );
  }

  if (rec.summary && rec.summary.trim().length > 0) {
    return translateText(rec.summary, language);
  }

  if (rec.decisive_factors && rec.decisive_factors.length > 0) {
    return translateText(rec.decisive_factors[0], language);
  }

  return translateText('No operational summary available.', language);
}

/**
 * Extracts the four essential local conditions (Waves, Wind, Visibility, Hazards)
 * directly from structured backend fields (threshold_comparisons, evidence items, map layers).
 * Preserves missing values as '—' (never coerced to 0).
 */
export function extractFisherConditions(response: ChatResponse | null): FisherConditions {
  if (!response) {
    return {
      waves: '—',
      wind: '—',
      visibility: '—',
      hazard: '—',
    };
  }

  let waveVal: string | null = null;
  let windVal: string | null = null;
  let visVal: string | null = null;
  let hazardVal: string | null = null;

  const thresholdChecks = response.recommendation?.threshold_comparisons || [];
  const evidenceList = response.evidence || [];

  // 1. Significant Wave Height
  const waveTc = thresholdChecks.find((tc) =>
    ['significant_wave_height_m', 'significant_wave_height', 'wave_height_m'].includes(
      tc.metric_name
    )
  );
  if (waveTc && waveTc.observed_value !== null && waveTc.observed_value !== undefined) {
    const v = waveTc.observed_value;
    waveVal = typeof v === 'number' ? `${v.toFixed(1)} m` : `${v} m`;
  } else {
    const waveEv = evidenceList.find((ev) =>
      ['significant_wave_height', 'wave_height_m', 'wave_height'].includes(ev.metric_name || '')
    );
    if (waveEv && waveEv.metric_value !== null && waveEv.metric_value !== undefined) {
      const v = waveEv.metric_value;
      const unit = waveEv.metric_unit || 'm';
      waveVal = typeof v === 'number' ? `${v.toFixed(1)} ${unit}` : `${v} ${unit}`;
    }
  }

  // 2. Wind Speed
  const windTc = thresholdChecks.find((tc) =>
    ['wind_speed_knots', 'wind_speed', 'wind_speed_kts'].includes(tc.metric_name)
  );
  if (windTc && windTc.observed_value !== null && windTc.observed_value !== undefined) {
    const v = windTc.observed_value;
    windVal = typeof v === 'number' ? `${v.toFixed(1)} kn` : `${v} kn`;
  } else {
    const windEv = evidenceList.find((ev) =>
      ['wind_speed', 'wind_speed_knots', 'wind_speed_kmh', 'wind_speed_kts'].includes(
        ev.metric_name || ''
      )
    );
    if (windEv && windEv.metric_value !== null && windEv.metric_value !== undefined) {
      const v = windEv.metric_value;
      const unit = windEv.metric_unit === 'knots' ? 'kn' : windEv.metric_unit || 'kn';
      windVal = typeof v === 'number' ? `${v.toFixed(1)} ${unit}` : `${v} ${unit}`;
    }
  }

  // 3. Visibility
  const visEv = evidenceList.find((ev) =>
    ['visibility', 'visibility_km', 'visibility_nm', 'visibility_m'].includes(ev.metric_name || '')
  );
  if (visEv && visEv.metric_value !== null && visEv.metric_value !== undefined) {
    const v = visEv.metric_value;
    const unit = visEv.metric_unit || 'km';
    visVal = typeof v === 'number' ? `${v.toFixed(1)} ${unit}` : `${v} ${unit}`;
  }

  // 4. Active Hazards
  const cycloneActive = thresholdChecks.some(
    (tc) => tc.metric_name === 'cyclone_warning_active' && Boolean(tc.observed_value)
  );
  const squallActive = thresholdChecks.some(
    (tc) => tc.metric_name === 'squall_alert' && Boolean(tc.observed_value)
  );

  const decisiveStr = (response.recommendation?.decisive_factors || []).join(' ').toLowerCase();

  if (cycloneActive || decisiveStr.includes('cyclone') || decisiveStr.includes('cyclonic')) {
    hazardVal = 'Cyclone Warning';
  } else if (squallActive || decisiveStr.includes('squall')) {
    hazardVal = 'Squall Alert';
  } else if (decisiveStr.includes('boundary') || decisiveStr.includes('firing') || decisiveStr.includes('prohibited')) {
    hazardVal = 'Restricted Zone';
  } else {
    // Check map layers for hazard polygon
    const hazardLayer = (response.map_layers || []).find(
      (l) =>
        l.layer_id.includes('warning') ||
        l.layer_id.includes('hazard') ||
        l.style?.layer_category === 'hazard'
    );
    if (hazardLayer) {
      hazardVal = hazardLayer.name || 'Active Advisory';
    } else {
      const status = response.recommendation?.status;
      if (status === 'GO') {
        hazardVal = 'No Active Hazards';
      } else if (status === 'UNKNOWN') {
        hazardVal = 'Status Unknown';
      } else if (status === 'CAUTION') {
        hazardVal = 'Elevated Hazard';
      } else if (status === 'NO_GO') {
        hazardVal = 'Hazard Alert';
      }
    }
  }

  return {
    waves: waveVal || '—',
    wind: windVal || '—',
    visibility: visVal || '—',
    hazard: hazardVal || '—',
  };
}

export default function FisherDecisionSurface({
  activeResponse,
  isLoading = false,
  error = null,
  activeDiff = null,
  missionContext,
  language = 'en',
  onOpenVoyageSettings,
}: FisherDecisionSurfaceProps) {
  const status = getFisherDecisionStatus(activeResponse, error);
  const explanation = getFisherExplanation(activeResponse, status, language, error, isLoading);
  const conditions = extractFisherConditions(isLoading || error ? null : activeResponse);

  // Status visual attributes
  const statusConfig: Record<
    FisherDecisionStatus,
    { label: string; bgClass: string; icon: React.ReactNode; testId: string }
  > = {
    SAFE_TO_GO: {
      label: translateText('SAFE TO GO', language),
      bgClass: 'decision-safe',
      icon: <ShieldCheck size={22} className="decision-icon" />,
      testId: 'status-safe-to-go',
    },
    CAUTION: {
      label: translateText('CAUTION', language),
      bgClass: 'decision-caution',
      icon: <ShieldAlert size={22} className="decision-icon" />,
      testId: 'status-caution',
    },
    DO_NOT_GO: {
      label: translateText('DO NOT GO', language),
      bgClass: 'decision-nogo',
      icon: <ShieldX size={22} className="decision-icon" />,
      testId: 'status-do-not-go',
    },
    UNKNOWN: {
      label: translateText('UNKNOWN', language),
      bgClass: 'decision-unknown',
      icon: <HelpCircle size={22} className="decision-icon" />,
      testId: 'status-unknown',
    },
  };

  const currentCfg = isLoading
    ? {
        label: translateText('CHECKING…', language),
        bgClass: 'decision-loading',
        icon: <Loader2 size={22} className="decision-icon spin-icon" />,
        testId: 'status-loading',
      }
    : statusConfig[status];

  const harbor = missionContext?.origin_harbor || 'Ratnagiri';

  return (
    <section
      className="fisher-decision-surface"
      aria-label="Primary Mission Decision and Conditions"
      data-testid="fisher-decision-surface"
    >
      {/* Top Meta Bar: Harbor Context + Canonical Data Mode Disclosure */}
      <div className="fisher-decision-topbar">
        <div className="fisher-topbar-location">
          <span className="fisher-harbor-label">
            {translateText(harbor, language)}
          </span>
          {onOpenVoyageSettings && (
            <button
              type="button"
              className="fisher-change-context-btn"
              onClick={onOpenVoyageSettings}
              title={translateText('Change departure port or vessel', language)}
              aria-label={translateText('Voyage Settings', language)}
            >
              <SlidersHorizontal size={11} />
            </button>
          )}
        </div>

        <div
          className="fisher-data-mode-chip"
          title={CANONICAL_DATA_MODE_TOOLTIP}
          aria-label={CANONICAL_DATA_MODE_LABEL}
        >
          <Database size={11} />
          <span>{CANONICAL_DATA_MODE_LABEL}</span>
        </div>
      </div>

      {/* Primary Decision Card */}
      <div className={`fisher-decision-card ${currentCfg.bgClass}`} data-testid={currentCfg.testId}>
        <div className="decision-card-badge-row">
          <div className="decision-badge">
            {currentCfg.icon}
            <span className="decision-status-text">{currentCfg.label}</span>
          </div>

          {activeDiff && (
            <span className="decision-whatif-pill" title="What-If Simulation Result">
              {translateText('What-If Scenario', language)}
            </span>
          )}
        </div>

        {/* 1-Sentence Operational Explanation */}
        <p className="decision-explanation-text" data-testid="decision-explanation">
          {explanation}
        </p>
      </div>

      {/* Essential Local Conditions Strip (4 Tiles) */}
      <div className="fisher-conditions-grid" role="group" aria-label="Essential local conditions">
        <div className="condition-tile" data-testid="condition-waves">
          <div className="condition-tile-header">
            <WavesIcon size={13} className="condition-icon" />
            <span className="condition-label">{translateText('Waves', language)}</span>
          </div>
          <div className="condition-value">{conditions.waves}</div>
        </div>

        <div className="condition-tile" data-testid="condition-wind">
          <div className="condition-tile-header">
            <WindIcon size={13} className="condition-icon" />
            <span className="condition-label">{translateText('Wind', language)}</span>
          </div>
          <div className="condition-value">{conditions.wind}</div>
        </div>

        <div className="condition-tile" data-testid="condition-visibility">
          <div className="condition-tile-header">
            <Eye size={13} className="condition-icon" />
            <span className="condition-label">{translateText('Visibility', language)}</span>
          </div>
          <div className="condition-value">{conditions.visibility}</div>
        </div>

        <div className="condition-tile" data-testid="condition-hazard">
          <div className="condition-tile-header">
            <AlertTriangle size={13} className="condition-icon" />
            <span className="condition-label">{translateText('Hazard', language)}</span>
          </div>
          <div
            className={`condition-value condition-hazard-text ${
              conditions.hazard.includes('Alert') || conditions.hazard.includes('Warning')
                ? 'hazard-warning'
                : ''
            }`}
          >
            {translateText(conditions.hazard, language)}
          </div>
        </div>
      </div>
    </section>
  );
}
