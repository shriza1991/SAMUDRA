import React, { useState } from 'react';
import { AlertTriangle, Compass, Fish, MapPinned, Route, ShieldCheck, Zap } from 'lucide-react';
import type { MapLayer } from '../../types/contracts';
import type { OperationalMode } from '../../types/mission';

interface MissionMapBriefProps {
  layers: MapLayer[];
  selectedMode?: OperationalMode;
  onModeChange?: (mode: OperationalMode) => void;
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
}: MissionMapBriefProps) {
  const [internalMode, setInternalMode] = useState<OperationalMode>('safest');
  const activeMode = controlledMode ?? internalMode;

  const handleModeSelect = (mode: OperationalMode) => {
    setInternalMode(mode);
    onModeChange?.(mode);
  };

  if (!layers.length) {
    return (
      <div className="mission-map-brief map-brief-empty" role="status">
        <MapPinned size={17} />
        <span>Ask a mission question to view its PFZ, route, and safety layers here.</span>
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
    <aside className="mission-map-brief" aria-label="Mission map summary and corridor selection">
      <div className="map-brief-heading">
        <MapPinned size={16} />
        <span>Mission map & corridors</span>
      </div>

      <div className="map-brief-stats">
        <BriefStat icon={<Fish size={14} />} label="PFZ" count={pfzLayers.length} active={pfzLayers.length > 0} />
        <BriefStat icon={<Route size={14} />} label="Routes" count={routeLayers.length} active={routeLayers.length > 0} />
        <BriefStat icon={<AlertTriangle size={14} />} label="Hazards" count={hazardLayers.length} active={hazardLayers.length > 0} critical />
      </div>

      {/* Operational corridor strategy selector when routes or PFZ exist */}
      {(routeLayers.length > 0 || pfzLayers.length > 0) && (
        <div className="map-corridor-section">
          <div className="map-corridor-label">Operational Strategy:</div>
          <div className="map-corridor-modes" role="radiogroup" aria-label="Operational navigation mode">
            {OPERATIONAL_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`map-corridor-chip ${activeMode === m.id ? 'active' : ''}`}
                onClick={() => handleModeSelect(m.id)}
                aria-pressed={activeMode === m.id}
                title={m.strategy}
              >
                {m.icon}
                <span>{m.label}</span>
                <span className="corridor-badge">{m.badge}</span>
              </button>
            ))}
          </div>

          <div className="map-corridor-info">
            <small>{OPERATIONAL_MODES.find((m) => m.id === activeMode)?.strategy}</small>
            {routeDistance && (
              <span className="map-route-metric">
                Est. Distance: <strong>{routeDistance} km</strong>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="map-brief-layer-list">
        {layers.slice(0, 3).map((layer) => (
          <span key={layer.layer_id}>
            <i style={{ backgroundColor: layer.style?.color || '#38bdf8' }} /> {layer.name}
          </span>
        ))}
        {layers.length > 3 && <span>+{layers.length - 3} more layers</span>}
      </div>
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
