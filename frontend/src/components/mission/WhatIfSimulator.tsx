import { useState } from 'react';
import { ArrowRight, Check, Clock, Cpu, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { DecisionDiff, MissionContext, WhatIfParameters } from '../../types/mission';
import { translateText, type SupportedLanguage } from '../../i18n/translations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface WhatIfSimulatorProps {
  currentContext: MissionContext;
  currentStatus?: string;
  language?: SupportedLanguage;
  isLoading?: boolean;
  activeDiff?: DecisionDiff | null;
  onSimulate: (params: WhatIfParameters, queryText: string) => void;
  onApplyContext: (newContext: MissionContext) => void;
  className?: string;
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
  className,
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

  const getStatusBadgeVariant = (st: string): 'go' | 'caution' | 'noGo' | 'unknown' | 'secondary' => {
    const s = st.toUpperCase();
    if (s.includes('GO') && !s.includes('NO')) return 'go';
    if (s.includes('CAUTION')) return 'caution';
    if (s.includes('NO')) return 'noGo';
    if (s.includes('UNKNOWN')) return 'unknown';
    return 'secondary';
  };

  return (
    <div className={cn('what-if-container rounded-lg border border-border/80 bg-background/50 overflow-hidden', className)} aria-label="Mission Twin What-If Simulator">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'what-if-toggle-btn w-full justify-between h-auto p-3 text-left font-normal rounded-none border-b border-transparent',
          isOpen && 'border-border/80 bg-muted/30 active'
        )}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="what-if-toggle-left flex items-center gap-2">
          <Cpu size={14} className="what-if-icon text-primary" />
          <strong className="text-xs font-bold text-foreground">{translateText('Mission Twin', language)}</strong>
          <Badge variant="outline" className="what-if-tag text-[10px] font-medium text-muted-foreground">
            {translateText('What-If Simulation', language)}
          </Badge>
        </span>
        <SlidersHorizontal size={13} className="text-muted-foreground" />
      </Button>

      {isOpen && (
        <div className="what-if-panel p-3.5 space-y-3.5">
          <p className="what-if-description text-xs text-muted-foreground leading-relaxed">
            {translateText('Current status:', language)}{' '}
            <strong className="text-foreground">{currentStatus.replace('_', '-')}</strong>.{' '}
            {translateText('Simulate counterfactual voyage parameters (temporal window, vessel limits) against deterministic risk rules.', language)}
          </p>

          {/* Temporal delay selector */}
          <div className="what-if-section space-y-1.5">
            <span className="what-if-label flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Clock size={12} /> {translateText('Departure window offset:', language)}
            </span>
            <div className="what-if-time-chips flex flex-wrap gap-1.5" role="radiogroup" aria-label="Departure delay offset">
              {TIME_OFFSETS.map((t) => (
                <Button
                  key={t.hours}
                  type="button"
                  variant={timeOffset === t.hours ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'what-if-chip h-7 px-2.5 text-xs font-medium',
                    timeOffset === t.hours && 'active shadow-xs'
                  )}
                  onClick={() => setTimeOffset(t.hours)}
                  aria-pressed={timeOffset === t.hours}
                >
                  {t.label === 'Now' ? translateText('Now', language) : t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Vessel profile & Objective selectors */}
          <div className="what-if-grid grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="what-if-field space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">{translateText('Vessel profile', language)}</span>
              <Select
                value={craftOverride}
                onValueChange={(val) => setCraftOverride(val as MissionContext['craft_profile'])}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRAFT_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      {translateText(c.label, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="what-if-field space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">{translateText('Objective', language)}</span>
              <Select
                value={objective}
                onValueChange={(val) => setObjective(val as 'pfz' | 'safety' | 'transit')}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((o) => {
                    let translatedLabel: string = o.label;
                    if (o.value === 'pfz') translatedLabel = `🐟 ${translateText('PFZ Harvesting', language)}`;
                    else if (o.value === 'safety') translatedLabel = `⚓ ${translateText('Coastal Safety', language)}`;
                    else if (o.value === 'transit') translatedLabel = `🧭 ${translateText('Safe Passage', language)}`;
                    return (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {translatedLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action button */}
          <div className="what-if-actions pt-1">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="what-if-run-btn w-full gap-1.5 text-xs font-semibold shadow-xs"
              onClick={handleRunSimulation}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={13} className="spin animate-spin" /> {translateText('Simulating...', language)}
                </>
              ) : (
                <>
                  <Sparkles size={13} /> {translateText('Run What-If Simulation', language)}
                </>
              )}
            </Button>
          </div>

          {/* Decision Diff card */}
          {activeDiff && (
            <Card className="what-if-diff-card border-primary/30 bg-card/80 p-3 shadow-xs" role="region" aria-label="Decision Diff Analysis">
              <CardContent className="p-0 space-y-2.5">
                <div className="diff-header flex items-center justify-between">
                  <span className="diff-title text-xs font-bold text-foreground">
                    {translateText('Counterfactual Decision Impact', language)}
                  </span>
                  <Badge variant="outline" className="diff-timestamp text-[10px]">
                    +{activeDiff.timeOffsetHours}h {translateText('offset', language)}
                  </Badge>
                </div>
                <div className="diff-comparison flex items-center justify-between rounded-md bg-background/80 p-2 border border-border/50">
                  <div className="diff-status-item flex flex-col items-center gap-0.5">
                    <small className="text-[10px] uppercase font-bold text-muted-foreground">{translateText('Baseline', language)}</small>
                    <Badge variant={getStatusBadgeVariant(activeDiff.baselineStatus)} className="status-pill text-xs font-bold">
                      {activeDiff.baselineStatus.replace('_', '-')}
                    </Badge>
                  </div>
                  <ArrowRight size={14} className="diff-arrow text-muted-foreground" />
                  <div className="diff-status-item flex flex-col items-center gap-0.5">
                    <small className="text-[10px] uppercase font-bold text-muted-foreground">{translateText('Simulated', language)}</small>
                    <Badge variant={getStatusBadgeVariant(activeDiff.simulatedStatus)} className="status-pill text-xs font-bold">
                      {activeDiff.simulatedStatus.replace('_', '-')}
                    </Badge>
                  </div>
                </div>

                {activeDiff.summary && (
                  <p className="diff-summary text-xs text-muted-foreground leading-relaxed">
                    {translateText(activeDiff.summary, language)}
                  </p>
                )}

                {craftOverride !== currentContext.craft_profile && (
                  <Button
                    type="button"
                    variant={applied ? 'secondary' : 'outline'}
                    size="sm"
                    className={cn('diff-apply-btn w-full gap-1.5 text-xs', applied && 'applied')}
                    onClick={handleApply}
                    disabled={applied}
                  >
                    {applied ? (
                      <>
                        <Check size={13} className="text-emerald-500" /> {translateText('Profile Applied', language)}
                      </>
                    ) : (
                      translateText('Apply simulated craft to mission context', language)
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
