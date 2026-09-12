import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Compass, Fish, MapPinned, Route, ShieldCheck, Zap } from 'lucide-react';
import type { MapLayer } from '../../types/contracts';
import type { OperationalMode } from '../../types/mission';
import { translateText, type SupportedLanguage } from '../../i18n/translations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MissionMapBriefProps {
  layers: MapLayer[];
  selectedMode?: OperationalMode;
  onModeChange?: (mode: OperationalMode) => void;
  language?: SupportedLanguage;
  className?: string;
}

const OPERATIONAL_MODES: Array<{
  id: OperationalMode;
  label: string;
  badge: string;
  icon: React.ReactNode;
  strategy: string;
}> = [
  {
    id: 'safest',
    label: 'Safest Corridor',
    badge: 'Min Risk',
    icon: <ShieldCheck size={13} />,
    strategy: 'Maximizes distance from squall advisory & naval firing buffers',
  },
  {
    id: 'balanced',
    label: 'Balanced Corridor',
    badge: 'Optimal',
    icon: <Compass size={13} />,
    strategy: 'Balanced transit time & wave height exposure along coast',
  },
  {
    id: 'direct',
    label: 'Direct Passage',
    badge: 'Fastest',
    icon: <Zap size={13} />,
    strategy: 'Direct bearing to target PFZ coordinate (highest weather sensitivity)',
  },
];

export default function MissionMapBrief({
  layers,
  selectedMode: controlledMode,
  onModeChange,
  language = 'en',
  className,
}: MissionMapBriefProps) {
  const [internalMode, setInternalMode] = useState<OperationalMode>('safest');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const activeMode = controlledMode ?? internalMode;

  const handleModeSelect = (mode: OperationalMode) => {
    setInternalMode(mode);
    onModeChange?.(mode);
  };

  if (!layers.length) {
    return (
      <Card className={cn('mission-map-brief map-brief-empty border-border/80 bg-card/90 p-2.5 shadow-md backdrop-blur-sm', className)} role="status">
        <CardContent className="p-0 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPinned size={16} className="text-primary shrink-0" />
          <span>{translateText('Ask a mission question to view its PFZ, route, and safety layers here.', language)}</span>
        </CardContent>
      </Card>
    );
  }

  const pfzLayers = layers.filter((layer) => includesAny(layer, ['pfz', 'fishing']));
  const routeLayers = layers.filter((layer) => includesAny(layer, ['route', 'corridor', 'passage']));
  const hazardLayers = layers.filter((layer) =>
    includesAny(layer, ['hazard', 'warning', 'geofence', 'restriction', 'boundary', 'safety'])
  );

  const primaryRoute = routeLayers[0];
  const routeDistance = extractRouteDistance(primaryRoute);

  return (
    <Card
      className={cn(
        'mission-map-brief border-border/80 bg-card/90 shadow-md backdrop-blur-sm transition-all',
        isCollapsed ? 'collapsed p-2' : 'p-3',
        className
      )}
      aria-label="Mission map summary and corridor selection"
    >
      <CardContent className="p-0 space-y-2.5">
        <div className="map-brief-heading flex items-center justify-between">
          <div className="map-brief-heading-left flex items-center gap-2 text-xs font-bold text-foreground">
            <MapPinned size={14} className="text-primary" />
            <span>{translateText('Mission map & corridors', language)}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="map-brief-toggle-btn size-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand mission brief' : 'Collapse mission brief'}
            aria-label={isCollapsed ? 'Expand mission brief' : 'Collapse mission brief'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </Button>
        </div>

        {isCollapsed ? (
          <div className="map-brief-collapsed-summary flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
            <span>{hazardLayers.length} {translateText('Hazards', language)}</span>
            {routeLayers.length > 0 && <span> · {routeLayers.length} {translateText('Routes', language)}</span>}
            {pfzLayers.length > 0 && <span> · {pfzLayers.length} {translateText('PFZ', language)}</span>}
          </div>
        ) : (
          <>
            <div className="map-brief-stats flex items-center gap-2">
              <BriefStat icon={<Fish size={13} />} label={translateText('PFZ', language)} count={pfzLayers.length} active={pfzLayers.length > 0} />
              <BriefStat icon={<Route size={13} />} label={translateText('Routes', language)} count={routeLayers.length} active={routeLayers.length > 0} />
              <BriefStat icon={<AlertTriangle size={13} />} label={translateText('Hazards', language)} count={hazardLayers.length} active={hazardLayers.length > 0} critical />
            </div>

            {(routeLayers.length > 0 || pfzLayers.length > 0) && (
              <div className="map-corridor-section space-y-2 pt-1 border-t border-border/50">
                <div className="map-corridor-label text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {translateText('Operational Strategy:', language)}
                </div>
                <div className="map-corridor-modes flex flex-wrap gap-1.5" role="radiogroup" aria-label="Operational navigation mode">
                  {OPERATIONAL_MODES.map((m) => (
                    <Button
                      key={m.id}
                      type="button"
                      variant={activeMode === m.id ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'map-corridor-chip h-7 gap-1.5 px-2 text-xs font-medium',
                        activeMode === m.id && 'active shadow-xs'
                      )}
                      onClick={() => handleModeSelect(m.id)}
                      aria-pressed={activeMode === m.id}
                      title={translateText(m.strategy, language)}
                    >
                      {m.icon}
                      <span>{translateText(m.label, language)}</span>
                      <Badge variant={activeMode === m.id ? 'secondary' : 'outline'} className="corridor-badge text-[9px] h-3.5 px-1 font-semibold">
                        {translateText(m.badge, language)}
                      </Badge>
                    </Button>
                  ))}
                </div>

                <div className="map-corridor-info text-[11px] text-muted-foreground flex justify-between items-center pt-0.5">
                  <small className="leading-snug">{translateText(OPERATIONAL_MODES.find((m) => m.id === activeMode)?.strategy ?? '', language)}</small>
                  {routeDistance && (
                    <span className="map-route-metric font-semibold text-foreground shrink-0 ml-2">
                      {translateText('Est. Distance:', language)} <strong>{routeDistance} km</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BriefStat({
  icon,
  label,
  count,
  active,
  critical = false,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  critical?: boolean;
}) {
  return (
    <div
      className={cn(
        'map-brief-stat flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border border-border/50 font-medium',
        active ? 'bg-background/80 text-foreground' : 'text-muted-foreground opacity-60',
        critical && active && 'border-rose-500/30 text-rose-600 dark:text-rose-400'
      )}
    >
      {icon}
      <strong>{count}</strong>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function includesAny(layer: MapLayer, terms: string[]): boolean {
  const haystack = `${layer.layer_id} ${layer.name} ${layer.style?.layer_category ?? ''}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function extractRouteDistance(layer?: MapLayer): number | null {
  if (!layer?.geojson) return null;
  const gj = layer.geojson as Record<string, unknown>;
  if (gj.type === 'Feature' && gj.properties && typeof (gj.properties as Record<string, unknown>).distance_km === 'number') {
    return (gj.properties as Record<string, unknown>).distance_km as number;
  }
  return null;
}
