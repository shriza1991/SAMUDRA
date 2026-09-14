import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { AlertTriangle, Info, Navigation, ShieldAlert } from 'lucide-react';
import type { HazardBulletin } from '../../api/researcher-client';

const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export interface HazardSpatialMapProps {
  hazards: HazardBulletin[];
  selectedHazardId?: string | null;
  onSelectHazard?: (hazardId: string) => void;
  loading?: boolean;
}

/**
 * Pure coordinate pair normalizer.
 * Accepts [number, number] or "lon lat" string pairs and validates coordinate ranges.
 */
function normalizeCoordPair(raw: any): [number, number] | null {
  let lon: number;
  let lat: number;

  if (Array.isArray(raw) && raw.length >= 2) {
    lon = Number(raw[0]);
    lat = Number(raw[1]);
  } else if (typeof raw === 'string') {
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 2) {
      lon = Number(parts[0]);
      lat = Number(parts[1]);
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (
    isNaN(lon) ||
    isNaN(lat) ||
    lon < -180 ||
    lon > 180 ||
    lat < -90 ||
    lat > 90 ||
    (lon === 0 && lat === 0)
  ) {
    return null;
  }

  return [lon, lat];
}

/**
 * Normalizes a single polygon ring (array of coordinate pairs).
 * Ensures at least 3 distinct coordinates and proper closure.
 */
function normalizeRing(ring: any[]): [number, number][] | null {
  if (!Array.isArray(ring) || ring.length < 3) return null;

  const validPoints: [number, number][] = [];
  for (const item of ring) {
    const pt = normalizeCoordPair(item);
    if (pt) {
      validPoints.push(pt);
    }
  }

  if (validPoints.length < 3) return null;

  // Ensure closure
  const first = validPoints[0];
  const last = validPoints[validPoints.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    validPoints.push([first[0], first[1]]);
  }

  return validPoints.length >= 4 ? validPoints : null;
}

/**
 * Pure data transformation: converts Hazard bulletins with polygon geometries into a valid GeoJSON FeatureCollection.
 * Filters out invalid geometries without throwing or generating synthetic coordinates.
 */
export function buildHazardGeoJSON(hazards: HazardBulletin[]): GeoJSON.FeatureCollection {
  const validFeatures: GeoJSON.Feature[] = [];

  for (const h of hazards || []) {
    if (!h || !h.geometry_geojson) continue;

    const geom = h.geometry_geojson;
    const geomType = geom.type;

    if (geomType === 'Polygon' && Array.isArray(geom.coordinates)) {
      const normalizedRings: [number, number][][] = [];
      for (const ring of geom.coordinates) {
        const validRing = normalizeRing(ring);
        if (validRing) {
          normalizedRings.push(validRing);
        }
      }

      if (normalizedRings.length > 0) {
        validFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: normalizedRings,
          },
          properties: {
            public_id: h.public_id,
            headline: h.headline,
            event_type: h.event_type || 'GENERAL_HAZARD',
            severity: h.severity || 'UNKNOWN',
            status: h.status || 'ACTIVE',
            is_active: h.status === 'ACTIVE',
            is_expired: h.status === 'EXPIRED',
            issued_at: h.issued_at,
            valid_until: h.valid_until,
            source: h.source,
            affected_area: h.affected_area || '',
            description: h.description || '',
            qc_status: h.qc_status || 'VALID',
            provenance_json: h.provenance_json || null,
          },
        });
      }
    } else if (geomType === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
      const normalizedPolygons: [number, number][][][] = [];
      for (const poly of geom.coordinates) {
        const polyRings: [number, number][][] = [];
        if (Array.isArray(poly)) {
          for (const ring of poly) {
            const validRing = normalizeRing(ring);
            if (validRing) {
              polyRings.push(validRing);
            }
          }
        }
        if (polyRings.length > 0) {
          normalizedPolygons.push(polyRings);
        }
      }

      if (normalizedPolygons.length > 0) {
        validFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: normalizedPolygons,
          },
          properties: {
            public_id: h.public_id,
            headline: h.headline,
            event_type: h.event_type || 'GENERAL_HAZARD',
            severity: h.severity || 'UNKNOWN',
            status: h.status || 'ACTIVE',
            is_active: h.status === 'ACTIVE',
            is_expired: h.status === 'EXPIRED',
            issued_at: h.issued_at,
            valid_until: h.valid_until,
            source: h.source,
            affected_area: h.affected_area || '',
            description: h.description || '',
            qc_status: h.qc_status || 'VALID',
            provenance_json: h.provenance_json || null,
          },
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features: validFeatures,
  };
}

export default function HazardSpatialMap({
  hazards,
  selectedHazardId,
  onSelectHazard,
  loading = false,
}: HazardSpatialMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const isLoadedRef = useRef(false);

  const geojson = useMemo(() => buildHazardGeoJSON(hazards), [hazards]);
  const hasValidPolygons = geojson.features.length > 0;

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_DARK,
      center: [73.0, 16.5], // Default initial center
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
      map.addSource('hazard-polygons-source', {
        type: 'geojson',
        data: geojson,
      });

      // Layer: Polygon Fill (color mapped by severity; lower opacity for expired)
      map.addLayer({
        id: 'hazards-fill',
        type: 'fill',
        source: 'hazard-polygons-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'severity'],
            'WARNING',
            '#ef4444',
            'ALERT',
            '#f97316',
            'WATCH',
            '#f59e0b',
            'ADVISORY',
            '#38bdf8',
            'NORMAL',
            '#64748b',
            /* default / unknown */
            '#94a3b8',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'status'], 'EXPIRED'],
            0.08,
            0.28,
          ],
        },
      });

      // Layer: Active / Planned Hazard Outlines (solid line)
      map.addLayer({
        id: 'hazards-outline-active',
        type: 'line',
        source: 'hazard-polygons-source',
        filter: ['!=', ['get', 'status'], 'EXPIRED'],
        paint: {
          'line-color': [
            'match',
            ['get', 'severity'],
            'WARNING',
            '#ef4444',
            'ALERT',
            '#f97316',
            'WATCH',
            '#f59e0b',
            'ADVISORY',
            '#38bdf8',
            'NORMAL',
            '#64748b',
            '#94a3b8',
          ],
          'line-width': 2.2,
          'line-opacity': 0.9,
        },
      });

      // Layer: Expired Hazard Outlines (dashed line)
      map.addLayer({
        id: 'hazards-outline-expired',
        type: 'line',
        source: 'hazard-polygons-source',
        filter: ['==', ['get', 'status'], 'EXPIRED'],
        paint: {
          'line-color': '#94a3b8',
          'line-width': 1.4,
          'line-opacity': 0.45,
          'line-dasharray': [3, 3],
        },
      });

      // Layer: Selected Polygon Highlight
      map.addLayer({
        id: 'hazards-outline-selected',
        type: 'line',
        source: 'hazard-polygons-source',
        filter: ['==', ['get', 'public_id'], selectedHazardId || ''],
        paint: {
          'line-color': '#ffffff',
          'line-width': 3.5,
          'line-opacity': 1.0,
        },
      });

      // Layer: Event Type label
      map.addLayer({
        id: 'hazards-symbol-label',
        type: 'symbol',
        source: 'hazard-polygons-source',
        layout: {
          'text-field': ['get', 'event_type'],
          'text-size': 11,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': '#0f172a',
          'text-halo-width': 2,
        },
      });

      // Interactivity: Click on hazard polygon
      map.on('click', 'hazards-fill', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties as any;

        const hazardId = props.public_id;
        if (onSelectHazard) {
          onSelectHazard(hazardId);
        }

        renderPopup(e.lngLat, props, map);
      });

      map.on('mouseenter', 'hazards-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'hazards-fill', () => {
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

  // Update GeoJSON data when hazards change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    const source = map.getSource('hazard-polygons-source') as maplibregl.GeoJSONSource | undefined;
    if (source && typeof source.setData === 'function') {
      source.setData(geojson);
    }

    fitMapToBounds(map, geojson);
  }, [geojson]);

  // Update selected hazard highlight and camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    if (map.getLayer('hazards-outline-selected')) {
      map.setFilter('hazards-outline-selected', ['==', ['get', 'public_id'], selectedHazardId || '']);
    }

    if (selectedHazardId) {
      const selectedFeature = geojson.features.find(
        (f) => f.properties?.public_id === selectedHazardId
      );
      if (selectedFeature) {
        const coords = getFeatureCoordinates(selectedFeature);
        if (coords.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          coords.forEach((pt) => bounds.extend(pt));
          map.fitBounds(bounds, {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            maxZoom: 9.5,
            duration: 700,
          });

          // Open popup at center of polygon
          const center = bounds.getCenter();
          renderPopup(center, selectedFeature.properties, map);
        }
      }
    }
  }, [selectedHazardId, geojson]);

  function getFeatureCoordinates(feature: GeoJSON.Feature): [number, number][] {
    const coords: [number, number][] = [];
    if (feature.geometry.type === 'Polygon') {
      const poly = feature.geometry as GeoJSON.Polygon;
      poly.coordinates.forEach((ring) => {
        ring.forEach((pt) => coords.push(pt as [number, number]));
      });
    } else if (feature.geometry.type === 'MultiPolygon') {
      const mpoly = feature.geometry as GeoJSON.MultiPolygon;
      mpoly.coordinates.forEach((poly) => {
        poly.forEach((ring) => {
          ring.forEach((pt) => coords.push(pt as [number, number]));
        });
      });
    }
    return coords;
  }

  // Popup renderer
  function renderPopup(
    lngLat: maplibregl.LngLatLike,
    props: any,
    map: maplibregl.Map
  ) {
    if (popupRef.current) {
      popupRef.current.remove();
    }

    const eventType = props.event_type || 'HAZARD';
    const severity = props.severity || 'UNKNOWN';
    const status = props.status || 'ACTIVE';
    const isExpired = status === 'EXPIRED';
    const headline = props.headline || 'Marine Hazard Alert';
    const source = props.source || 'IMD Coastal Bulletin';
    const affectedArea = props.affected_area || '—';
    const qc = props.qc_status || 'VALID';
    const issuedAt = props.issued_at ? new Date(props.issued_at).toLocaleString() : '—';
    const validUntil = props.valid_until ? new Date(props.valid_until).toLocaleString() : '—';

    const htmlContent = `
      <div class="hazard-map-popup">
        <div class="hazard-popup-header">
          <span class="hazard-popup-type">${eventType}</span>
          <span class="hazard-popup-severity ${severity.toLowerCase()}">${severity}</span>
          <span class="hazard-popup-status ${isExpired ? 'expired' : 'active'}">${status}</span>
        </div>
        <div class="hazard-popup-headline">${headline}</div>
        <div class="hazard-popup-grid">
          <div class="hazard-popup-metric">
            <span class="hazard-popup-label">Valid Period</span>
            <span class="hazard-popup-val mono">${issuedAt} → ${validUntil}</span>
          </div>
          <div class="hazard-popup-metric">
            <span class="hazard-popup-label">Affected Area</span>
            <span class="hazard-popup-val">${affectedArea}</span>
          </div>
          <div class="hazard-popup-metric">
            <span class="hazard-popup-label">QC Status</span>
            <span class="hazard-popup-val badge-qc ${qc.toLowerCase()}">${qc}</span>
          </div>
          <div class="hazard-popup-metric">
            <span class="hazard-popup-label">Source</span>
            <span class="hazard-popup-val">${source}</span>
          </div>
        </div>
        ${props.description ? `<div class="hazard-popup-desc">${props.description}</div>` : ''}
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: 12,
      closeButton: true,
      closeOnClick: false,
      className: 'hazard-spatial-popup-wrapper',
    })
      .setLngLat(lngLat)
      .setHTML(htmlContent)
      .addTo(map);

    popupRef.current = popup;
  }

  // Bounds fitting helper
  function fitMapToBounds(map: maplibregl.Map, fc: GeoJSON.FeatureCollection) {
    if (fc.features.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    fc.features.forEach((feat) => {
      const coords = getFeatureCoordinates(feat);
      coords.forEach((coord) => bounds.extend(coord));
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 40, bottom: 40, left: 40, right: 40 },
        maxZoom: 9.5,
        duration: 800,
      });
    }
  }

  return (
    <div className="researcher-hazard-map-wrapper" data-testid="hazard-spatial-map">
      <div className="researcher-hazard-map-header">
        <div className="researcher-hazard-map-title">
          <ShieldAlert size={15} className="researcher-hazard-map-icon" />
          <span>Observed / Advisory Hazard Polygons</span>
          <span className="researcher-hazard-count-badge">
            {geojson.features.length} Polygons
          </span>
        </div>
        <div className="researcher-hazard-legend">
          <div className="hazard-legend-group">
            <span className="hazard-legend-item">
              <span className="hazard-legend-line solid" /> Active / Planned
            </span>
            <span className="hazard-legend-item">
              <span className="hazard-legend-line dashed" /> Expired (Historical)
            </span>
          </div>
          <div className="hazard-legend-group">
            <span className="hazard-legend-item">
              <span className="hazard-legend-dot warning" /> Warning
            </span>
            <span className="hazard-legend-item">
              <span className="hazard-legend-dot alert" /> Alert
            </span>
            <span className="hazard-legend-item">
              <span className="hazard-legend-dot watch" /> Watch
            </span>
            <span className="hazard-legend-item">
              <span className="hazard-legend-dot advisory" /> Advisory
            </span>
          </div>
        </div>
      </div>

      <div className="researcher-hazard-map-canvas-wrap">
        <div ref={containerRef} className="researcher-hazard-map-canvas" />

        {/* Empty State Overlay */}
        {!loading && !hasValidPolygons && (
          <div className="researcher-hazard-empty-overlay">
            <AlertTriangle size={20} className="hazard-empty-icon" />
            <span>No spatial hazard polygons available for rendering.</span>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="researcher-hazard-empty-overlay">
            <Navigation size={20} className="researcher-spinner" />
            <span>Loading hazard polygons…</span>
          </div>
        )}
      </div>

      <div className="researcher-hazard-map-footer">
        <Info size={12} />
        <span>Synthetic hazard polygons · source-faithful demonstration data</span>
      </div>
    </div>
  );
}
