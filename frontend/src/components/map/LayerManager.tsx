import type { MapLayer } from '../../types/contracts';
import { X, Eye, EyeOff, ShieldAlert, Navigation } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { translateText, type SupportedLanguage } from '../../i18n/translations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LayerManagerProps {
  layers: MapLayer[];
  visibility: Record<string, boolean>;
  onToggle: (layerId: string) => void;
  onClose?: () => void;
  language?: SupportedLanguage;
  className?: string;
}

export default function LayerManager({
  layers,
  visibility,
  onToggle,
  onClose,
  language = 'en',
  className,
}: LayerManagerProps) {
  const safetyLayers = layers.filter(
    l => l.style?.layer_category === 'safety_critical' ||
         l.style?.layer_category === 'base_geofence' ||
         l.layer_id.startsWith('base_') ||
         l.layer_id.includes('hazard') ||
         l.layer_id.includes('geofence') ||
         l.layer_id.includes('safety')
  );
  const navigationLayers = layers.filter(l => !safetyLayers.includes(l));

  const renderLayerList = (items: MapLayer[], title?: string, icon?: React.ReactNode) => {
    if (!items.length) return null;
    return (
      <div className="layer-group mb-2 space-y-1">
        {title && (
          <div className="layer-group-title flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {icon}
            <span>{translateText(title, language)}</span>
          </div>
        )}
        {items.map(layer => {
          const isVisible = visibility[layer.layer_id] ?? layer.visible;
          return (
            <Button
              key={layer.layer_id}
              type="button"
              variant={isVisible ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'layer-item w-full justify-between h-8 px-2.5 text-xs font-medium',
                !isVisible && 'text-muted-foreground opacity-60'
              )}
              onClick={() => onToggle(layer.layer_id)}
              aria-pressed={isVisible}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="layer-color-dot size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: layer.style?.color || '#38bdf8' }}
                />
                <span className="layer-name truncate">{translateText(layer.name, language)}</span>
              </div>
              {isVisible ? <Eye size={13} className="text-primary shrink-0" /> : <EyeOff size={13} className="shrink-0" />}
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn('layer-manager w-72 rounded-xl border border-border/80 bg-card p-3 shadow-xl', className)} role="region" aria-label="Map layer controls">
      <div className="layer-manager-header flex items-center justify-between border-b border-border/60 pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          <h4 className="layer-manager-title text-xs font-bold text-foreground">{translateText('Map Layers', language)}</h4>
          <Badge variant="outline" className="h-4 px-1 text-[10px]">
            {layers.length}
          </Badge>
        </div>
        <Popover.Close asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="layer-manager-close size-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close layer panel"
          >
            <X size={14} />
          </Button>
        </Popover.Close>
      </div>

      <div className="layer-manager-list max-h-64 overflow-y-auto pr-0.5 space-y-1">
        {safetyLayers.length > 0 && navigationLayers.length > 0 ? (
          <>
            {renderLayerList(safetyLayers, 'Safety Critical', <ShieldAlert size={12} className="text-rose-500" />)}
            {renderLayerList(navigationLayers, 'Navigation & Operational', <Navigation size={12} className="text-sky-500" />)}
          </>
        ) : (
          renderLayerList(layers)
        )}
      </div>
    </div>
  );
}
