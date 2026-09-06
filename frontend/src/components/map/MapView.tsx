import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapLayer } from '../../types/contracts';
import LayerManager from './LayerManager';
import { Layers } from 'lucide-react';

/** Ratnagiri, Maharashtra — pilot demo center */
const DEFAULT_CENTER: [number, number] = [73.28, 16.99];
const DEFAULT_ZOOM = 8;

/** Free vector tile source for MapLibre */
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
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
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

  // Manage GeoJSON layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addLayers = () => {
      // Initialize visibility state
      const vis: Record<string, boolean> = {};

      for (const layer of layers) {
        const sourceId = `src-${layer.layer_id}`;
        const layerId = layer.layer_id;
        vis[layerId] = layer.visible;

        // Remove existing layer/source if present
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(`${layerId}-outline`)) map.removeLayer(`${layerId}-outline`);
        if (map.getLayer(`${layerId}-circle`)) map.removeLayer(`${layerId}-circle`);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        const geojson = layer.geojson;
        map.addSource(sourceId, { type: 'geojson', data: geojson as GeoJSON.GeoJSON });

        const color = layer.style?.color || '#38bdf8';
        const opacity = layer.style?.opacity ?? 0.6;
        const lineWidth = layer.style?.line_width ?? 2;

        // Detect geometry type and add appropriate layer
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

        // Add popup on click
        map.on('click', layerId, (e) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const props = feature.properties || {};

          const html = Object.entries(props)
            .filter(([k]) => k !== 'label')
            .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
            .join('<br/>');

          const popupContent = props.label
            ? `<div class="map-popup"><strong>${props.label}</strong><br/>${html}</div>`
            : `<div class="map-popup">${html}</div>`;

          new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      }

      setLayerVisibility(vis);
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
          <span>{layers.length}</span>
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

/** Extract the primary geometry type from a GeoJSON object */
function getGeometryType(geojson: MapLayer['geojson']): string {
  if (geojson.type === 'FeatureCollection' && geojson.features?.length) {
    return geojson.features[0].geometry?.type || 'Point';
  }
  if (geojson.type === 'Feature') {
    return (geojson as GeoJSON.Feature).geometry?.type || 'Point';
  }
  return 'Point';
}
