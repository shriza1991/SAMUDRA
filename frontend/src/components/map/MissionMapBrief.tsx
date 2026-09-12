import type React from 'react';
import { AlertTriangle, Fish, MapPinned, Route } from 'lucide-react';
import type { MapLayer } from '../../types/contracts';

interface MissionMapBriefProps {
  layers: MapLayer[];
}

/** A response-driven map legend; it never creates or infers navigation advice. */
export default function MissionMapBrief({ layers }: MissionMapBriefProps) {
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
  const hazardLayers = layers.filter((layer) => includesAny(layer, ['hazard', 'warning', 'geofence', 'restriction', 'boundary', 'safety']));

  return (
    <aside className="mission-map-brief" aria-label="Mission map summary">
      <div className="map-brief-heading">
        <MapPinned size={16} />
        <span>Mission map</span>
      </div>
      <p>Tap features for source details. Use Layers to control visibility.</p>
      <div className="map-brief-stats">
        <BriefStat icon={<Fish size={14} />} label="PFZ" count={pfzLayers.length} active={pfzLayers.length > 0} />
        <BriefStat icon={<Route size={14} />} label="Routes" count={routeLayers.length} active={routeLayers.length > 0} />
        <BriefStat icon={<AlertTriangle size={14} />} label="Hazards" count={hazardLayers.length} active={hazardLayers.length > 0} critical />
      </div>
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
