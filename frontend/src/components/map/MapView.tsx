import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapLayer } from '../../types/contracts';
import LayerManager from './LayerManager';
import { Layers } from 'lucide-react';

/** Initial fallback center (Indian coastal waters) */
const INITIAL_CENTER: [number, number] = [73.28, 16.99];
const INITIAL_ZOOM = 7;

/** CartoDB Dark Matter style */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface MapViewProps {
  layers: MapLayer[];
}

export default function MapView({ layers }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Manage GeoJSON layers dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addLayers = () => {
      const vis: Record<string, boolean> = {};
      const bounds = new maplibregl.LngLatBounds();
      let hasCoordinates = false;

      for (const layer of layers) {
        const sourceId = `src-${layer.layer_id}`;
        const layerId = layer.layer_id;
        vis[layerId] = layer.visible;

        // Clean up previous instances of this layer if updating
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(`${layerId}-outline`)) map.removeLayer(`${layerId}-outline`);
        if (map.getLayer(`${layerId}-circle`)) map.removeLayer(`${layerId}-circle`);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        const geojson = layer.geojson;
        map.addSource(sourceId, { type: 'geojson', data: geojson as GeoJSON.GeoJSON });

        // Collect bounds dynamically from GeoJSON coordinates
        collectBounds(geojson, bounds, () => {
          hasCoordinates = true;
        });

        const color = layer.style?.color || '#38bdf8';
        const opacity = layer.style?.opacity ?? 0.6;
        const lineWidth = layer.style?.line_width ?? 2;

        const geomType = getGeometryType(geojson);

        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
          map.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': color,
              'fill-opacity': opacity,
            },
          });
          map.addLayer({
            id: `${layerId}-outline`,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': color,
              'line-width': lineWidth,
              'line-opacity': Math.min(opacity + 0.3, 1),
            },
          });
        } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
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
        } else if (geomType === 'Point' || geomType === 'MultiPoint') {
          map.addLayer({
            id: layerId,
            type: 'circle',
            source: sourceId,
            paint: {
              'circle-radius': 8,
              'circle-color': color,
              'circle-opacity': opacity,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });
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
            .setHTML(`<div class="map-popup"><h5 style="margin:0 0 6px;color:#38bdf8">${layer.name}</h5>${html}</div>`)
            .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      }

      setLayerVisibility(vis);

      // Dynamically fit map bounds to the received GeoJSON layers
      if (hasCoordinates && !bounds.isEmpty()) {
        try {
          map.fitBounds(bounds, { padding: 50, maxZoom: 13, duration: 1000 });
        } catch {
          // Fallback if bounds are a single point
        }
      }
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.on('load', addLayers);
    }
  }, [layers]);

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
