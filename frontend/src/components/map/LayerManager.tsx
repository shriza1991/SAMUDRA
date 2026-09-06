import type { MapLayer } from '../../types/contracts';
import { X, Eye, EyeOff } from 'lucide-react';

interface LayerManagerProps {
  layers: MapLayer[];
  visibility: Record<string, boolean>;
  onToggle: (layerId: string) => void;
  onClose: () => void;
}

export default function LayerManager({ layers, visibility, onToggle, onClose }: LayerManagerProps) {
  return (
    <div className="layer-manager" role="region" aria-label="Map layer controls">
      <div className="layer-manager-header">
        <h4 className="layer-manager-title">Map Layers</h4>
        <button className="layer-manager-close" onClick={onClose} aria-label="Close layer panel">
          <X size={16} />
        </button>
      </div>
      <div className="layer-manager-list">
        {layers.map(layer => {
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
    </div>
  );
}
