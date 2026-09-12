import { useState } from 'react';
import { ArrowRight, Check, Clock, Cpu, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { DecisionDiff, MissionContext, WhatIfParameters } from '../../types/mission';
import type { SupportedLanguage } from '../../i18n/translations';

interface WhatIfSimulatorProps {
  currentContext: MissionContext;
  currentStatus?: string;
  language?: SupportedLanguage;
  isLoading?: boolean;
  activeDiff?: DecisionDiff | null;
  onSimulate: (params: WhatIfParameters, queryText: string) => void;
  onApplyContext: (newContext: MissionContext) => void;
}

const TIME_OFFSETS = [
  { label: 'Now', hours: 0 },
  { label: '+2h', hours: 2 },
  { label: '+4h', hours: 4 },
  { label: '+6h', hours: 6 },
  { label: '+12h', hours: 12 },
];

const CRAFT_OPTIONS = [
  { value: 'traditional_non_motorized', label: 'Traditional craft' },
  { value: 'motorized_boat', label: 'Motorized boat' },
  { value: 'mechanized_trawler', label: 'Mechanized trawler' },
] as const;

const OBJECTIVES = [
  { value: 'pfz', label: '🐟 PFZ Harvesting' },
  { value: 'safety', label: '⚓ Coastal Safety' },
  { value: 'transit', label: '🧭 Safe Passage' },
] as const;

export default function WhatIfSimulator({
  currentContext,
  currentStatus = 'READY',
  language = 'en',
  isLoading = false,
  activeDiff,
  onSimulate,
  onApplyContext,
}: WhatIfSimulatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeOffset, setTimeOffset] = useState<number>(4);
  const [craftOverride, setCraftOverride] = useState<MissionContext['craft_profile']>(
    currentContext.craft_profile ?? 'motorized_boat'
  );
  const [objective, setObjective] = useState<'pfz' | 'safety' | 'transit'>('pfz');
  const [applied, setApplied] = useState(false);

  const craftLabel = CRAFT_OPTIONS.find((c) => c.value === craftOverride)?.label ?? 'Motorized boat';
  const harbor = currentContext.origin_harbor ?? 'Ratnagiri';

  const handleRunSimulation = () => {
    setApplied(false);
    let query: string;
    if (language === 'hi') {
      query = timeOffset === 0
        ? `${harbor} से ${craftLabel} के साथ वर्तमान मौसम में निकलना कैसा है?`
        : `यदि मैं ${harbor} से प्रस्थान ${timeOffset} घंटे विलंबित करूँ (${craftLabel}), तो क्या स्थिति अनुकूल होगी?`;
    } else if (language === 'mr') {
      query = timeOffset === 0
        ? `${harbor} वरून ${craftLabel} सह सध्या समुद्रात जाणे सुरक्षित आहे का?`
        : `जर मी ${harbor} वरून प्रस्थान ${timeOffset} तास पुढे ढकलले (${craftLabel}), तर स्थिती कशी असेल?`;
    } else {
      query = timeOffset === 0
        ? `What is the voyage risk departing from ${harbor} now with a ${craftLabel}?`
        : `What if I delay departure from ${harbor} by ${timeOffset} hours with a ${craftLabel}?`;
    }

    onSimulate(
      {
        timeOffsetHours: timeOffset,
        craftProfileOverride: craftOverride,
        objective,
      },
      query
    );
  };

  const handleApply = () => {
    onApplyContext({
      origin_harbor: currentContext.origin_harbor,
      craft_profile: craftOverride,
    });
    setApplied(true);
  };

  return (
    <div className="what-if-container" aria-label="Mission Twin What-If Simulator">
      <button
        type="button"
        className={`what-if-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="what-if-toggle-left">
          <Cpu size={14} className="what-if-icon" />
          <strong>Mission Twin</strong>
          <span className="what-if-tag">What-If Simulation</span>
        </span>
        <SlidersHorizontal size={13} />
      </button>

      {isOpen && (
        <div className="what-if-panel">
          <p className="what-if-description">
            Current status: <strong>{currentStatus.replace('_', '-')}</strong>. Simulate counterfactual voyage parameters (temporal window, vessel limits) against deterministic risk rules.
          </p>

          {/* Temporal delay selector */}
          <div className="what-if-section">
            <span className="what-if-label">
              <Clock size={12} /> Departure window offset:
            </span>
            <div className="what-if-time-chips" role="radiogroup" aria-label="Departure delay offset">
              {TIME_OFFSETS.map((t) => (
                <button
                  key={t.hours}
                  type="button"
                  className={`what-if-chip ${timeOffset === t.hours ? 'active' : ''}`}
                  onClick={() => setTimeOffset(t.hours)}
                  aria-pressed={timeOffset === t.hours}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vessel profile & Objective selectors */}
          <div className="what-if-grid">
            <label className="what-if-field">
              <span>Vessel profile</span>
              <select
                value={craftOverride}
                onChange={(e) => setCraftOverride(e.target.value as MissionContext['craft_profile'])}
              >
                {CRAFT_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="what-if-field">
              <span>Objective</span>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as 'pfz' | 'safety' | 'transit')}
              >
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Action button */}
          <div className="what-if-actions">
            <button
              type="button"
              className="what-if-run-btn"
              onClick={handleRunSimulation}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={13} className="spin" /> Simulating...
                </>
              ) : (
                <>
                  <Sparkles size={13} /> Run What-If Simulation
                </>
              )}
            </button>
          </div>

          {/* Decision Diff card */}
          {activeDiff && (
            <div className="what-if-diff-card" role="region" aria-label="Decision Diff Analysis">
              <div className="diff-header">
                <span className="diff-title">Counterfactual Decision Impact</span>
                <span className="diff-timestamp">+{activeDiff.timeOffsetHours}h offset</span>
              </div>
              <div className="diff-comparison">
                <div className="diff-status-item">
                  <small>Baseline</small>
                  <span className={`status-pill status-${activeDiff.baselineStatus.toLowerCase().replace('_', '-')}`}>
                    {activeDiff.baselineStatus.replace('_', '-')}
                  </span>
                </div>
                <ArrowRight size={14} className="diff-arrow" />
                <div className="diff-status-item">
                  <small>Simulated</small>
                  <span className={`status-pill status-${activeDiff.simulatedStatus.toLowerCase().replace('_', '-')}`}>
                    {activeDiff.simulatedStatus.replace('_', '-')}
                  </span>
                </div>
              </div>

              {activeDiff.summary && (
                <p className="diff-summary">{activeDiff.summary}</p>
              )}

              {craftOverride !== currentContext.craft_profile && (
                <button
                  type="button"
                  className={`diff-apply-btn ${applied ? 'applied' : ''}`}
                  onClick={handleApply}
                  disabled={applied}
                >
                  {applied ? (
                    <>
                      <Check size={13} /> Profile Applied
                    </>
                  ) : (
                    'Apply simulated craft to mission context'
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
