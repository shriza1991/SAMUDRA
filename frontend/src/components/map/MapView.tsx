import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import * as Popover from '@radix-ui/react-popover';
import type { MapLayer } from '../../types/contracts';
import LayerManager from './LayerManager';
import MissionMapBrief from './MissionMapBrief';
import { Layers } from 'lucide-react';
import type { SupportedLanguage } from '../../i18n/translations';

/** Initial fallback center (Indian coastal waters) */
const INITIAL_CENTER: [number, number] = [73.28, 16.99];
const INITIAL_ZOOM = 7;

/** CartoDB Vector Basemap Styles */
const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface MapViewProps {
  layers: MapLayer[];
  theme?: 'light' | 'dark';
  center?: [number, number];
  zoom?: number;
  language?: SupportedLanguage;
}

export default function MapView({ layers, theme = 'light', center, zoom, language = 'en' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeLayersRef = useRef<{ layers: string[]; sources: string[] }>({ layers: [], sources: [] });
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});

  const activeStyle = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
  const currentStyleRef = useRef(activeStyle);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter = center || INITIAL_CENTER;
    const initialZoom = zoom || INITIAL_ZOOM;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: activeStyle,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const activePopupRef = useRef<maplibregl.Popup | null>(null);
  const attachedListenersRef = useRef<Set<string>>(new Set());
  const activeReplayVesselRef = useRef<string | null>(null);
  const activeReplayTriggerRef = useRef<number | undefined>(undefined);

  // Animate map when programmatic center or zoom changes (only if no active replay trajectory is being tracked)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;

    if (activeReplayVesselRef.current) return;

    const cur = map.getCenter();
    if (Math.abs(cur.lng - center[0]) > 0.001 || Math.abs(cur.lat - center[1]) > 0.001) {
      map.flyTo({
        center,
        zoom: zoom ?? 8.5,
        duration: 900,
        essential: true,
      });
    }
  }, [center?.[0], center?.[1], zoom]);

  // Update map style ONLY when theme actually changes after initial mount
  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentStyleRef.current === activeStyle) return;

    currentStyleRef.current = activeStyle;
    // Disabling diff avoids MapLibre error when switching completely different styles
    map.setStyle(activeStyle, { diff: false });
  }, [activeStyle]);

  // Manage GeoJSON layers dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncLayers = () => {
      const vis: Record<string, boolean> = {};
      const newRegisteredLayers: string[] = [];
      const newRegisteredSources: string[] = [];

      for (const layer of layers) {
        const sourceId = `src-${layer.layer_id}`;
        const layerId = layer.layer_id;
        vis[layerId] = layer.visible;
        newRegisteredSources.push(sourceId);

        const geojson = layer.geojson;
        const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;

        if (existingSource && typeof existingSource.setData === 'function') {
          existingSource.setData(geojson as GeoJSON.GeoJSON);
        } else if (!existingSource) {
          map.addSource(sourceId, { type: 'geojson', data: geojson as GeoJSON.GeoJSON });
        }

        const color = layer.style?.color || '#0284c7';
        const opacity = layer.style?.opacity ?? 0.6;
        const lineWidth = layer.style?.line_width ?? 2;
        const circleRadius = layer.style?.circle_radius ?? 8;

        const geomType = getGeometryType(geojson);
        const hasPointFeature =
          geomType === 'Point' ||
          geomType === 'MultiPoint' ||
          (geojson.type === 'FeatureCollection' &&
            Array.isArray(geojson.features) &&
            geojson.features.some((f: any) => f.geometry?.type === 'Point' || f.geometry?.type === 'MultiPoint'));

        const hasLineFeature =
          geomType === 'LineString' ||
          geomType === 'MultiLineString' ||
          (geojson.type === 'FeatureCollection' &&
            Array.isArray(geojson.features) &&
            geojson.features.some((f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'));

        const hasPolygonFeature =
          geomType === 'Polygon' ||
          geomType === 'MultiPolygon' ||
          (geojson.type === 'FeatureCollection' &&
            Array.isArray(geojson.features) &&
            geojson.features.some((f: any) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'));

        // 1. Polygon fills & outlines
        if (hasPolygonFeature) {
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: 'fill',
              source: sourceId,
              filter: ['in', '$type', 'Polygon'],
              paint: {
                'fill-color': color,
                'fill-opacity': opacity,
              },
            });
          }
          newRegisteredLayers.push(layerId);

          const outlineId = `${layerId}-outline`;
          if (!map.getLayer(outlineId)) {
            map.addLayer({
              id: outlineId,
              type: 'line',
              source: sourceId,
              filter: ['in', '$type', 'Polygon'],
              paint: {
                'line-color': color,
                'line-width': lineWidth,
                'line-opacity': Math.min(opacity + 0.35, 1),
              },
            });
          }
          newRegisteredLayers.push(outlineId);
        }

        // 2. LineString tracks & routes
        if (hasLineFeature) {
          const lineLayerId = hasPolygonFeature ? `${layerId}-line` : layerId;
          if (!map.getLayer(lineLayerId)) {
            map.addLayer({
              id: lineLayerId,
              type: 'line',
              source: sourceId,
              filter: ['in', '$type', 'LineString'],
              paint: {
                'line-color': color,
                'line-width': lineWidth,
                'line-opacity': opacity,
              },
              layout: {
                'line-cap': 'round',
                'line-join': 'round',
              },
            });
          }
          newRegisteredLayers.push(lineLayerId);
        }

        // 3. Point positions & markers
        if (hasPointFeature) {
          const pointLayerId = (hasPolygonFeature || hasLineFeature) ? `${layerId}-circle` : layerId;
          if (!map.getLayer(pointLayerId)) {
            map.addLayer({
              id: pointLayerId,
              type: 'circle',
              source: sourceId,
              filter: ['in', '$type', 'Point'],
              paint: {
                'circle-radius': circleRadius,
                'circle-color': color,
                'circle-opacity': opacity,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              },
            });
          }
          newRegisteredLayers.push(pointLayerId);
        }

        // Interactive popups for non-background layers
        const isBackgroundZone = layerId.toLowerCase().includes('eez') || layer.style?.layer_category === 'background';
        const interactiveLayerId = hasPointFeature && (hasPolygonFeature || hasLineFeature)
          ? `${layerId}-circle`
          : layerId;

        if (!isBackgroundZone && !attachedListenersRef.current.has(interactiveLayerId)) {
          attachedListenersRef.current.add(interactiveLayerId);

          map.on('click', interactiveLayerId, (e) => {
            if (!e.features?.length) return;
            const feature = e.features[0];
            const props = feature.properties || {};

            activePopupRef.current?.remove();

            const ignoredKeys = new Set([
              'polygon_id', 'id', 'polygon_type', 'is_hard_restriction', 'objectid', 'object_id',
              'layer_id', 'layer_type', 'source', 'type', 'geometry_type', 'home_harbor_id'
            ]);

            const entries = Object.entries(props).filter(([k]) => !ignoredKeys.has(k.toLowerCase()));

            const html = entries.length > 0
              ? entries
                  .slice(0, 6)
                  .map(([k, v]) => `<div style="margin-bottom:2px"><strong>${k.replace(/_/g, ' ')}:</strong> ${formatPropValue(v)}</div>`)
                  .join('')
              : `<div><em>${layer.name}</em></div>`;

            const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: 10 })
              .setLngLat(e.lngLat)
              .setHTML(`<div class="map-popup"><h5 style="margin:0 0 6px;color:#0284c7;font-size:12px;font-weight:700">${layer.name}</h5>${html}</div>`)
              .addTo(map);

            activePopupRef.current = popup;
          });

          map.on('mouseenter', interactiveLayerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', interactiveLayerId, () => { map.getCanvas().style.cursor = ''; });
        }
      }

      // Clean up removed layers (cleanly removes layers no longer present)
      for (const oldLayerId of activeLayersRef.current.layers) {
        if (!newRegisteredLayers.includes(oldLayerId)) {
          if (map.getLayer(oldLayerId)) map.removeLayer(oldLayerId);
          attachedListenersRef.current.delete(oldLayerId);
        }
      }

      // Clean up removed sources
      for (const oldSourceId of activeLayersRef.current.sources) {
        if (!newRegisteredSources.includes(oldSourceId)) {
          if (map.getSource(oldSourceId)) map.removeSource(oldSourceId);
        }
      }

      activeLayersRef.current = { layers: newRegisteredLayers, sources: newRegisteredSources };
      setLayerVisibility(vis);

      // Trajectory Replay Auto-Zoom Logic
      const replayLayer = layers.find(
        (l) => l.layer_id === 'layer_fleet_vessel_replay' || l.style?.layer_category === 'fleet_replay'
      );

      if (replayLayer) {
        const replayVesselId =
          (replayLayer as any).properties?.vessel_id ||
          (replayLayer.geojson as any)?.properties?.vessel_id ||
          (replayLayer.geojson as any)?.features?.[0]?.properties?.vessel_id ||
          replayLayer.name;
        const focusTrigger = (replayLayer as any).properties?.focus_trigger;

        const isNewVessel = replayVesselId !== activeReplayVesselRef.current;
        const isFocusRequested = focusTrigger !== undefined && focusTrigger !== activeReplayTriggerRef.current;

        if (isNewVessel || isFocusRequested) {
          activeReplayVesselRef.current = replayVesselId;
          activeReplayTriggerRef.current = focusTrigger;

          const replayBounds = new maplibregl.LngLatBounds();
          const bbox = (replayLayer as any).properties?.bbox || (replayLayer.geojson as any)?.bbox;
          if (Array.isArray(bbox) && bbox.length === 4) {
            replayBounds.extend([bbox[0], bbox[1]]);
            replayBounds.extend([bbox[2], bbox[3]]);
          } else {
            collectBounds(replayLayer.geojson, replayBounds, () => {});
          }

          if (!replayBounds.isEmpty()) {
            const sw = replayBounds.getSouthWest();
            const ne = replayBounds.getNorthEast();
            const isTightPoint = Math.abs(sw.lng - ne.lng) < 0.003 && Math.abs(sw.lat - ne.lat) < 0.003;

            if (isTightPoint) {
              map.flyTo({ center: [sw.lng, sw.lat], zoom: 12.5, duration: 900, essential: true });
            } else {
              try {
                map.fitBounds(replayBounds, {
                  padding: { top: 80, bottom: 80, left: 80, right: 80 },
                  maxZoom: 13.0,
                  duration: 900,
                  essential: true,
                });
              } catch {
                map.flyTo({
                  center: [(sw.lng + ne.lng) / 2, (sw.lat + ne.lat) / 2],
                  zoom: 12.0,
                  duration: 900,
                  essential: true,
                });
              }
            }
          }
        }
        // When advancing replay timeline for the same vessel, do NOT fitBounds — leave user camera completely uninterrupted!
      } else {
        // No replay layer active: clear replay state
        activeReplayVesselRef.current = null;
        activeReplayTriggerRef.current = undefined;

        // Auto-fit bounds ONLY for operational query response layers (e.g. PFZ polygons, hazard alerts), never base EEZ/sector polygons
        const operationalLayers = layers.filter(
          (l) =>
            l.visible &&
            !l.layer_id.startsWith('base_') &&
            !l.layer_id.startsWith('sector_') &&
            l.style?.layer_category !== 'base_geofence' &&
            l.style?.layer_category !== 'surveillance' &&
            l.style?.layer_category !== 'background' &&
            !l.layer_id.toLowerCase().includes('eez')
        );

        if (operationalLayers.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          let hasOperationalCoords = false;
          for (const l of operationalLayers) {
            collectBounds(l.geojson, bounds, () => { hasOperationalCoords = true; });
          }
          if (hasOperationalCoords && !bounds.isEmpty()) {
            try {
              map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 1000 });
            } catch {
              // fallback gracefully
            }
          }
        }
      }
    };

    if (map.isStyleLoaded()) {
      syncLayers();
    } else {
      map.once('load', syncLayers);
      map.once('style.load', syncLayers);
    }
  }, [layers, activeStyle]);

  const toggleLayer = useCallback((layerId: string) => {
    const map = mapRef.current;
    if (!map) return;

    setLayerVisibility(prev => {
      const newVis = !prev[layerId];
      const visibility = newVis ? 'visible' : 'none';

      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
      if (map.getLayer(`${layerId}-outline`)) {
        map.setLayoutProperty(`${layerId}-outline`, 'visibility', visibility);
      }
      if (map.getLayer(`${layerId}-circle`)) {
        map.setLayoutProperty(`${layerId}-circle`, 'visibility', visibility);
      }

      return { ...prev, [layerId]: newVis };
    });
  }, []);

  return (
    <section className="map-view" aria-label="Geospatial map viewport">
      <div ref={containerRef} className="map-container" />

      <MissionMapBrief layers={layers} language={language} />

      {layers.length > 0 && (
        <Popover.Root open={showLayerPanel} onOpenChange={setShowLayerPanel}>
          <Popover.Trigger asChild>
            <button
              className="map-layer-toggle"
              aria-label="Toggle layer panel"
            >
              <Layers size={18} />
              <span>
                {layers.length}{' '}
                {language === 'hi' ? 'परतें' : language === 'mr' ? 'स्तर' : 'Layers'}
              </span>
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              className="layer-manager-popover"
              side="bottom"
              align="end"
              sideOffset={6}
              collisionPadding={12}
            >
              <LayerManager
                layers={layers}
                visibility={layerVisibility}
                onToggle={toggleLayer}
                onClose={() => setShowLayerPanel(false)}
                language={language}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </section>
  );
}

/** Recursively traverse GeoJSON and expand bounds */
function collectBounds(geojson: any, bounds: maplibregl.LngLatBounds, onCoord: () => void) {
  if (!geojson) return;

  const traverseCoords = (coords: any) => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      bounds.extend([coords[0], coords[1]]);
      onCoord();
    } else {
      for (const item of coords) {
        traverseCoords(item);
      }
    }
  };

  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    for (const f of geojson.features) {
      if (f.geometry?.coordinates) {
        traverseCoords(f.geometry.coordinates);
      }
    }
  } else if (geojson.type === 'Feature' && geojson.geometry?.coordinates) {
    traverseCoords(geojson.geometry.coordinates);
  } else if (geojson.coordinates) {
    traverseCoords(geojson.coordinates);
  }
}

/** Extract primary geometry type from GeoJSON */
function getGeometryType(geojson: MapLayer['geojson']): string {
  if (geojson.type === 'FeatureCollection' && geojson.features?.length) {
    return geojson.features[0].geometry?.type || 'Point';
  }
  if (geojson.type === 'Feature') {
    return (geojson as GeoJSON.Feature).geometry?.type || 'Point';
  }
  return (geojson as any)?.geometry?.type || 'Point';
}

function formatPropValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
