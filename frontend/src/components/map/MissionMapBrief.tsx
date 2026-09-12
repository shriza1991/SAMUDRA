import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Compass, Fish, MapPinned, Route, ShieldCheck, Zap } from 'lucide-react';
import type { MapLayer } from '../../types/contracts';
import type { OperationalMode } from '../../types/mission';
import { translateText, type SupportedLanguage } from '../../i18n/translations';

interface MissionMapBriefProps {
  layers: MapLayer[];
  selectedMode?: OperationalMode;
  onModeChange?: (mode: OperationalMode) => void;
  language?: SupportedLanguage;
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

/** A response-driven map legend & operational corridor selector. */
export default function MissionMapBrief({
  layers,
  selectedMode: controlledMode,
  onModeChange,
  language = 'en',
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
      <div className="mission-map-brief map-brief-empty" role="status">
        <MapPinned size={17} />
        <span>{translateText('Ask a mission question to view its PFZ, route, and safety layers here.', language)}</span>
      </div>
    );
  }

  const pfzLayers = layers.filter((layer) => includesAny(layer, ['pfz', 'fishing']));
  const routeLayers = layers.filter((layer) => includesAny(layer, ['route', 'corridor', 'passage']));
  const hazardLayers = layers.filter((layer) =>
    includesAny(layer, ['hazard', 'warning', 'geofence', 'restriction', 'boundary', 'safety'])
  );

  // Extract route distance if present in GeoJSON properties
  const primaryRoute = routeLayers[0];
  const routeDistance = extractRouteDistance(primaryRoute);

  return (
    <aside className={`mission-map-brief ${isCollapsed ? 'collapsed' : ''}`} aria-label="Mission map summary and corridor selection">
      <div className="map-brief-heading">
        <div className="map-brief-heading-left">
          <MapPinned size={15} />
          <span>{translateText('Mission map & corridors', language)}</span>
        </div>
        <button
          type="button"
          className="map-brief-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand mission brief' : 'Collapse mission brief'}
          aria-label={isCollapsed ? 'Expand mission brief' : 'Collapse mission brief'}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {isCollapsed ? (
        <div className="map-brief-collapsed-summary">
          <span>{hazardLayers.length} {translateText('Hazards', language)}</span>
          {routeLayers.length > 0 && <span> · {routeLayers.length} {translateText('Routes', language)}</span>}
          {pfzLayers.length > 0 && <span> · {pfzLayers.length} {translateText('PFZ', language)}</span>}
        </div>
      ) : (
        <>
          <div className="map-brief-stats">
            <BriefStat icon={<Fish size={14} />} label={translateText('PFZ', language)} count={pfzLayers.length} active={pfzLayers.length > 0} />
            <BriefStat icon={<Route size={14} />} label={translateText('Routes', language)} count={routeLayers.length} active={routeLayers.length > 0} />
            <BriefStat icon={<AlertTriangle size={14} />} label={translateText('Hazards', language)} count={hazardLayers.length} active={hazardLayers.length > 0} critical />
          </div>

          {/* Operational corridor strategy selector when routes or PFZ exist */}
          {(routeLayers.length > 0 || pfzLayers.length > 0) && (
            <div className="map-corridor-section">
              <div className="map-corridor-label">{translateText('Operational Strategy:', language)}</div>
              <div className="map-corridor-modes" role="radiogroup" aria-label="Operational navigation mode">
                {OPERATIONAL_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`map-corridor-chip ${activeMode === m.id ? 'active' : ''}`}
                    onClick={() => handleModeSelect(m.id)}
                    aria-pressed={activeMode === m.id}
                    title={translateText(m.strategy, language)}
                  >
                    {m.icon}
                    <span>{translateText(m.label, language)}</span>
                    <span className="corridor-badge">{translateText(m.badge, language)}</span>
                  </button>
                ))}
              </div>

              <div className="map-corridor-info">
                <small>{translateText(OPERATIONAL_MODES.find((m) => m.id === activeMode)?.strategy ?? '', language)}</small>
                {routeDistance && (
                  <span className="map-route-metric">
                    {translateText('Est. Distance:', language)} <strong>{routeDistance} km</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
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
    <div className={`map-brief-stat ${active ? 'active' : ''} ${critical && active ? 'critical' : ''}`}>
      {icon}<strong>{count}</strong><span>{label}</span>
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
