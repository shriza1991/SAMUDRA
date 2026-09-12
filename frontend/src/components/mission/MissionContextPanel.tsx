import { Anchor, ShipWheel } from 'lucide-react';
import type { DecisionDiff, MissionContext, OperationalRole, WhatIfParameters } from '../../types/mission';
import { translateText, type SupportedLanguage } from '../../i18n/translations';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import WhatIfSimulator from './WhatIfSimulator';

interface MissionContextPanelProps {
  context: MissionContext;
  role?: OperationalRole;
  currentStatus?: string;
  language?: SupportedLanguage;
  isLoading?: boolean;
  activeDiff?: DecisionDiff | null;
  onContextChange: (context: MissionContext) => void;
  onRoleChange?: (role: OperationalRole) => void;
  onSimulate?: (params: WhatIfParameters, queryText: string) => void;
  className?: string;
}

const HARBORS = ['Ratnagiri', 'Malvan', 'Panaji', 'Mumbai', 'Veraval', 'Porbandar'];

const CRAFT_PROFILES = [
  { value: 'traditional_non_motorized', label: 'Traditional craft' },
  { value: 'motorized_boat', label: 'Motorized boat' },
  { value: 'mechanized_trawler', label: 'Mechanized trawler' },
] as const;

export default function MissionContextPanel({
  context,
  currentStatus,
  language = 'en',
  isLoading = false,
  activeDiff,
  onContextChange,
  onSimulate,
  className,
}: MissionContextPanelProps) {
  const setHarbor = (origin_harbor: string) => onContextChange({ ...context, origin_harbor });
  const setCraft = (craft_profile: MissionContext['craft_profile']) => onContextChange({ ...context, craft_profile });

  return (
    <Card className={cn('mission-context-panel border-border/80 bg-card/60 shadow-xs', className)} aria-label="Mission context and dashboard view">
      <CardHeader className="p-4 pb-2">
        <div className="mission-context-heading flex items-center justify-between">
          <div>
            <span className="mission-context-eyebrow text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {translateText('Voyage controls', language)}
            </span>
            <CardTitle className="text-base font-bold text-foreground">
              {translateText('Mission context', language)}
            </CardTitle>
          </div>
          <Anchor size={18} className="text-primary" aria-hidden="true" />
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-3">
        <div className="mission-context-fields grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {translateText('Departure harbor', language)}
            </span>
            <Select value={context.origin_harbor ?? 'Ratnagiri'} onValueChange={setHarbor}>
              <SelectTrigger className="h-8 text-xs font-medium bg-background/80">
                <SelectValue placeholder={translateText('Select harbor', language)} />
              </SelectTrigger>
              <SelectContent>
                {HARBORS.map((harbor) => (
                  <SelectItem key={harbor} value={harbor} className="text-xs">
                    {harbor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <ShipWheel size={13} aria-hidden="true" />
              {translateText('Vessel profile', language)}
            </span>
            <Select
              value={context.craft_profile ?? 'motorized_boat'}
              onValueChange={(val) => setCraft(val as MissionContext['craft_profile'])}
            >
              <SelectTrigger className="h-8 text-xs font-medium bg-background/80">
                <SelectValue placeholder={translateText('Select vessel', language)} />
              </SelectTrigger>
              <SelectContent>
                {CRAFT_PROFILES.map((profile) => (
                  <SelectItem key={profile.value} value={profile.value} className="text-xs">
                    {translateText(profile.label, language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="mission-context-note text-[11px] text-muted-foreground leading-relaxed">
          {translateText('Voyage departure parameters and craft profile for deterministic marine safety calculation.', language)}
        </p>

        {onSimulate && (
          <div className="pt-1">
            <WhatIfSimulator
              currentContext={context}
              currentStatus={currentStatus}
              language={language}
              isLoading={isLoading}
              activeDiff={activeDiff}
              onSimulate={onSimulate}
              onApplyContext={onContextChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
