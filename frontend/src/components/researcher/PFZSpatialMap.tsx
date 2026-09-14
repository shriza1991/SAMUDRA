import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { MapPin, Info, AlertTriangle, Navigation } from 'lucide-react';
import type { PFZCandidate } from '../../api/researcher-client';

const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface PFZSpatialMapProps {
  candidates: PFZCandidate[];
  selectedCandidateId?: string | null;
  onSelectCandidate?: (candidateId: string) => void;
  loading?: boolean;
}

/**
 * Pure data transformation: converts PFZ candidates into a valid GeoJSON FeatureCollection.
 * Filters out invalid or missing coordinates without throwing.
 */
export function buildPFZGeoJSON(candidates: PFZCandidate[]): GeoJSON.FeatureCollection {
  const validFeatures = (candidates || [])
    .filter(
      (c) =>
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        !isNaN(c.latitude) &&
        !isNaN(c.longitude) &&
        (c.latitude !== 0 || c.longitude !== 0) &&
        c.latitude >= -90 &&
        c.latitude <= 90 &&
        c.longitude >= -180 &&
        c.longitude <= 180
    )
    .map((c) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [c.longitude, c.latitude],
      },
      properties: {
        public_id: c.public_id,
        rank: c.rank,
        confidence: c.confidence || 'UNKNOWN',
        sst_gradient: c.sst_gradient,
        chlorophyll_a_mg_m3: c.chlorophyll_a_mg_m3,
        depth_m: c.depth_m,
        distance_km: c.distance_km,
        bearing_deg: c.bearing_deg,
        status: c.status,
        qc_status: c.qc_status || 'VALID',
        valid_from: c.valid_from,
        valid_to: c.valid_to,
        source: c.source,
      },
    }));

  return {
    type: 'FeatureCollection',
    features: validFeatures,
  };
}

export default function PFZSpatialMap({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  loading = false,
}: PFZSpatialMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const isLoadedRef = useRef(false);

  const geojson = useMemo(() => buildPFZGeoJSON(candidates), [candidates]);
  const hasValidCoordinates = geojson.features.length > 0;

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_DARK,
      center: [73.0, 16.5], // Central Konkan coast fallback
      zoom: 7,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    map.on('load', () => {
      isLoadedRef.current = true;

      // Source
      map.addSource('pfz-candidates-source', {
        type: 'geojson',
        data: geojson,
      });

      // Layer: Glow/halo
      map.addLayer({
        id: 'pfz-candidates-glow',
        type: 'circle',
        source: 'pfz-candidates-source',
        paint: {
          'circle-radius': 15,
          'circle-color': '#10b981',
          'circle-opacity': 0.25,
        },
      });

      // Layer: Main marker circle
      map.addLayer({
        id: 'pfz-candidates-circle',
        type: 'circle',
        source: 'pfz-candidates-source',
        paint: {
          'circle-radius': 9,
          'circle-color': [
            'case',
            ['==', ['get', 'confidence'], 'HIGH'],
            '#10b981',
            ['==', ['get', 'confidence'], 'MEDIUM'],
            '#06b6d4',
            '#f59e0b',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Layer: Selected candidate highlight ring
      map.addLayer({
        id: 'pfz-candidate-selected-ring',
        type: 'circle',
        source: 'pfz-candidates-source',
        filter: ['==', ['get', 'public_id'], selectedCandidateId || ''],
        paint: {
          'circle-radius': 19,
          'circle-color': 'transparent',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#38bdf8',
          'circle-stroke-opacity': 0.9,
        },
      });

      // Layer: Rank symbol text
      map.addLayer({
        id: 'pfz-candidates-label',
        type: 'symbol',
        source: 'pfz-candidates-source',
        layout: {
          'text-field': ['concat', '#', ['to-string', ['get', 'rank']]],
          'text-size': 10,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#e2e8f0',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1.5,
        },
      });

      // Interactivity
      map.on('click', 'pfz-candidates-circle', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties as any;
        const geom = feature.geometry as GeoJSON.Point;

        const coords = geom.coordinates.slice() as [number, number];

        // Ensure popup displays over clicked feature
        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        const candId = props.public_id;
        if (onSelectCandidate) {
          onSelectCandidate(candId);
        }

        renderPopup(coords, props, map);
      });

      map.on('mouseenter', 'pfz-candidates-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'pfz-candidates-circle', () => {
        map.getCanvas().style.cursor = '';
      });

      // Fit bounds initially
      fitMapToBounds(map, geojson);
    });

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      if (popupRef.current) {
        popupRef.current.remove();
      }
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
    };
  }, []);

  // Update GeoJSON data when candidates change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    const source = map.getSource('pfz-candidates-source') as maplibregl.GeoJSONSource | undefined;
    if (source && typeof source.setData === 'function') {
      source.setData(geojson);
    }

    fitMapToBounds(map, geojson);
  }, [geojson]);

  // Update selected candidate highlight ring and camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    if (map.getLayer('pfz-candidate-selected-ring')) {
      map.setFilter('pfz-candidate-selected-ring', ['==', ['get', 'public_id'], selectedCandidateId || '']);
    }

    if (selectedCandidateId) {
      const selected = candidates.find((c) => c.public_id === selectedCandidateId);
      if (selected && typeof selected.latitude === 'number' && typeof selected.longitude === 'number') {
        map.flyTo({
          center: [selected.longitude, selected.latitude],
          zoom: Math.max(map.getZoom(), 8.8),
          duration: 700,
          essential: true,
        });

        // Open popup for selected
        renderPopup([selected.longitude, selected.latitude], selected, map);
      }
    }
  }, [selectedCandidateId, candidates]);

  // Popup renderer
  function renderPopup(coords: [number, number], props: any, map: maplibregl.Map) {
    if (popupRef.current) {
      popupRef.current.remove();
    }

    const sstGradientText =
      props.sst_gradient !== null && props.sst_gradient !== undefined
        ? Number(props.sst_gradient).toFixed(2)
        : '—';
    const chlaText =
      props.chlorophyll_a_mg_m3 !== null && props.chlorophyll_a_mg_m3 !== undefined
        ? `${Number(props.chlorophyll_a_mg_m3).toFixed(2)} mg/m³`
        : '—';
    const depthText =
      props.depth_m !== null && props.depth_m !== undefined ? `${Number(props.depth_m).toFixed(1)} m` : '—';
    const distanceText =
      props.distance_km !== null && props.distance_km !== undefined
        ? `${Number(props.distance_km).toFixed(1)} km`
        : '—';
    const bearingText =
      props.bearing_deg !== null && props.bearing_deg !== undefined ? `${props.bearing_deg}°` : '—';
    const confidenceText = props.confidence || 'UNKNOWN';
    const qcText = props.qc_status || 'VALID';
    const statusText = props.status || 'ACTIVE';

    const htmlContent = `
      <div class="pfz-map-popup">
        <div class="pfz-popup-header">
          <span class="pfz-popup-rank">#${props.rank || '—'}</span>
          <strong class="pfz-popup-title">${props.public_id || 'PFZ Candidate'}</strong>
          <span class="pfz-popup-conf ${confidenceText.toLowerCase()}">${confidenceText}</span>
        </div>
        <div class="pfz-popup-coords">
          ${coords[1].toFixed(4)}° N, ${coords[0].toFixed(4)}° E
        </div>
        <div class="pfz-popup-grid">
          <div class="pfz-popup-metric">
            <span class="pfz-popup-label">SST Gradient</span>
            <span class="pfz-popup-val mono">${sstGradientText}</span>
          </div>
          <div class="pfz-popup-metric">
            <span class="pfz-popup-label">Chlorophyll-a</span>
            <span class="pfz-popup-val mono">${chlaText}</span>
          </div>
          <div class="pfz-popup-metric">
            <span class="pfz-popup-label">Depth</span>
            <span class="pfz-popup-val mono">${depthText}</span>
          </div>
          <div class="pfz-popup-metric">
            <span class="pfz-popup-label">Distance / Bearing</span>
            <span class="pfz-popup-val mono">${distanceText} · ${bearingText}</span>
          </div>
          <div class="pfz-popup-metric">
            <span class="pfz-popup-label">QC Status</span>
            <span class="pfz-popup-val badge-qc ${qcText.toLowerCase()}">${qcText}</span>
          </div>
          <div class="pfz-popup-metric">
            <span class="pfz-popup-label">Status</span>
            <span class="pfz-popup-val badge-status">${statusText}</span>
          </div>
        </div>
        <div class="pfz-popup-footer">
          <span>Source: ${props.source || 'INCOIS PFZ Advisory'}</span>
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: 14,
      closeButton: true,
      closeOnClick: false,
      className: 'pfz-spatial-popup-wrapper',
    })
      .setLngLat(coords)
      .setHTML(htmlContent)
      .addTo(map);

    popupRef.current = popup;
  }

  // Bounds fitting helper
  function fitMapToBounds(map: maplibregl.Map, fc: GeoJSON.FeatureCollection) {
    if (fc.features.length === 0) return;

    if (fc.features.length === 1) {
      const coord = (fc.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      map.flyTo({ center: coord, zoom: 8.5, duration: 800 });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    fc.features.forEach((feat) => {
      const coord = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
      bounds.extend(coord);
    });

    map.fitBounds(bounds, {
      padding: { top: 40, bottom: 40, left: 40, right: 40 },
      maxZoom: 10,
      duration: 800,
    });
  }

  return (
    <div className="researcher-pfz-map-wrapper" data-testid="pfz-spatial-map">
      <div className="researcher-pfz-map-header">
        <div className="researcher-pfz-map-title">
          <MapPin size={15} className="researcher-pfz-map-icon" />
          <span>PFZ Candidate Spatial Distribution</span>
          <span className="researcher-pfz-count-badge">{geojson.features.length} Candidates</span>
        </div>
        <div className="researcher-pfz-legend">
          <span className="pfz-legend-item">
            <span className="pfz-legend-dot high" /> High Confidence
          </span>
          <span className="pfz-legend-item">
            <span className="pfz-legend-dot medium" /> Medium Confidence
          </span>
        </div>
      </div>

      <div className="researcher-pfz-map-canvas-wrap">
        <div ref={containerRef} className="researcher-pfz-map-canvas" />

        {/* Empty State Overlay */}
        {!loading && !hasValidCoordinates && (
          <div className="researcher-pfz-empty-overlay">
            <AlertTriangle size={20} className="pfz-empty-icon" />
            <span>No valid PFZ advisory candidate coordinates available for spatial plotting.</span>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="researcher-pfz-empty-overlay">
            <Navigation size={20} className="researcher-spinner" />
            <span>Loading PFZ candidate coordinates…</span>
          </div>
        )}
      </div>

      <div className="researcher-pfz-map-footer">
        <Info size={12} />
        <span>INCOIS PFZ-style candidate data · synthetic snapshot</span>
      </div>
    </div>
  );
}
