import type { MapLayer } from '../../types/contracts';
import { X, Eye, EyeOff, ShieldAlert, Navigation } from 'lucide-react';

interface LayerManagerProps {
  layers: MapLayer[];
  visibility: Record<string, boolean>;
  onToggle: (layerId: string) => void;
  onClose: () => void;
}

export default function LayerManager({ layers, visibility, onToggle, onClose }: LayerManagerProps) {
  const safetyLayers = layers.filter(
    l => l.style?.layer_category === 'safety_critical' ||
         l.layer_id.includes('hazard') ||
         l.layer_id.includes('geofence') ||
         l.layer_id.includes('safety')
  );
  const navigationLayers = layers.filter(l => !safetyLayers.includes(l));

  const renderLayerList = (items: MapLayer[], title?: string, icon?: React.ReactNode) => {
    if (!items.length) return null;
    return (
      <div className="layer-group mb-1">
        {title && (
          <div
            className="layer-group-title"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-dim, #94a3b8)',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {icon}
            <span>{title}</span>
          </div>
        )}
        {items.map(layer => {
          const isVisible = visibility[layer.layer_id] ?? layer.visible;
          return (
            <button
              key={layer.layer_id}
              className={`layer-item ${isVisible ? 'active' : 'inactive'}`}
              onClick={() => onToggle(layer.layer_id)}
              aria-pressed={isVisible}
            >
              <span
                className="layer-color-dot"
                style={{ backgroundColor: layer.style?.color || '#38bdf8' }}
              />
              <span className="layer-name">{layer.name}</span>
              {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="layer-manager" role="region" aria-label="Map layer controls">
      <div className="layer-manager-header">
        <h4 className="layer-manager-title">Map Layers ({layers.length})</h4>
        <button className="layer-manager-close" onClick={onClose} aria-label="Close layer panel">
          <X size={16} />
        </button>
      </div>
      <div className="layer-manager-list">
        {safetyLayers.length > 0 && navigationLayers.length > 0 ? (
          <>
            {renderLayerList(safetyLayers, 'Safety Critical', <ShieldAlert size={12} color="#f43f5e" />)}
            {renderLayerList(navigationLayers, 'Navigation & Operational', <Navigation size={12} color="#0ea5e9" />)}
          </>
        ) : (
          renderLayerList(layers)
        )}
      </div>
    </div>
  );
}

