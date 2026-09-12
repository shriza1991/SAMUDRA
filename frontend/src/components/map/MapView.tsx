import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapLayer } from '../../types/contracts';
import LayerManager from './LayerManager';
import MissionMapBrief from './MissionMapBrief';
import { Layers } from 'lucide-react';

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
}

export default function MapView({ layers, theme = 'light', center, zoom }: MapViewProps) {
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

  // Animate map when programmatic center or zoom changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;

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

    const addLayers = () => {
      // 1. Clean up ALL previously added layers and sources to prevent stale map state
      for (const id of activeLayersRef.current.layers) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of activeLayersRef.current.sources) {
        if (map.getSource(id)) map.removeSource(id);
      }
      activeLayersRef.current = { layers: [], sources: [] };

      const vis: Record<string, boolean> = {};
      const bounds = new maplibregl.LngLatBounds();
      let hasCoordinates = false;
      const registeredLayers: string[] = [];
      const registeredSources: string[] = [];

      for (const layer of layers) {
        const sourceId = `src-${layer.layer_id}`;
        const layerId = layer.layer_id;
        vis[layerId] = layer.visible;

        const geojson = layer.geojson;
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: 'geojson', data: geojson as GeoJSON.GeoJSON });
          registeredSources.push(sourceId);
        }

        // Collect bounds dynamically from GeoJSON coordinates
        collectBounds(geojson, bounds, () => {
          hasCoordinates = true;
        });

        const color = layer.style?.color || '#0284c7';
        const opacity = layer.style?.opacity ?? 0.6;
        const lineWidth = layer.style?.line_width ?? 2;
        const circleRadius = layer.style?.circle_radius ?? 8;

        const geomType = getGeometryType(geojson);

        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: 'fill',
              source: sourceId,
              paint: {
                'fill-color': color,
                'fill-opacity': opacity,
              },
            });
            registeredLayers.push(layerId);
          }

          const outlineId = `${layerId}-outline`;
          if (!map.getLayer(outlineId)) {
            map.addLayer({
              id: outlineId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': color,
                'line-width': lineWidth,
                'line-opacity': Math.min(opacity + 0.35, 1),
              },
            });
            registeredLayers.push(outlineId);
          }
        } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
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
            registeredLayers.push(layerId);
          }
        } else if (geomType === 'Point' || geomType === 'MultiPoint') {
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: 'circle',
              source: sourceId,
              paint: {
                'circle-radius': circleRadius,
                'circle-color': color,
                'circle-opacity': opacity,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              },
            });
            registeredLayers.push(layerId);
          }
        }

        // Add dynamic popup on click
        map.on('click', layerId, (e) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const props = feature.properties || {};

          const entries = Object.entries(props);
          const html = entries.length > 0
            ? entries
                .map(([k, v]) => `<div><strong>${k.replace(/_/g, ' ')}:</strong> ${formatPropValue(v)}</div>`)
                .join('')
            : `<div><em>${layer.name}</em></div>`;

          new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
            .setLngLat(e.lngLat)
            .setHTML(`<div class="map-popup"><h5 style="margin:0 0 6px;color:#0284c7">${layer.name}</h5>${html}</div>`)
            .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      }

      activeLayersRef.current = { layers: registeredLayers, sources: registeredSources };
      setLayerVisibility(vis);

      // Dynamically fit map bounds or fly to target
      if (hasCoordinates && !bounds.isEmpty()) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        // Check if bounds is a single coordinate point
        if (Math.abs(sw.lng - ne.lng) < 0.001 && Math.abs(sw.lat - ne.lat) < 0.001) {
          map.flyTo({ center: [sw.lng, sw.lat], zoom: 9.5, duration: 900 });
        } else {
          try {
            map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 1000 });
          } catch {
            map.flyTo({ center: [sw.lng, sw.lat], zoom: 9, duration: 900 });
          }
        }
      } else if (center) {
        map.flyTo({ center, zoom: zoom ?? 8.5, duration: 900 });
      }
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once('load', addLayers);
      map.once('style.load', addLayers);
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

      <MissionMapBrief layers={layers} />

      {layers.length > 0 && (
        <button
          className="map-layer-toggle"
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          aria-label="Toggle layer panel"
        >
          <Layers size={18} />
          <span>{layers.length} Layers</span>
        </button>
      )}

      {showLayerPanel && (
        <LayerManager
          layers={layers}
          visibility={layerVisibility}
          onToggle={toggleLayer}
          onClose={() => setShowLayerPanel(false)}
        />
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
