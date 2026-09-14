import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Satellite,
  Calendar,
  Info,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Activity,
  Maximize2,
  X,
} from 'lucide-react';
import type { EOGridCell } from '../../api/researcher-client';

const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export type EOMetricKey = 'sst_celsius' | 'chlorophyll_a_mg_m3' | 'cloud_cover_pct';

export interface EOMetricOption {
  key: EOMetricKey;
  label: string;
  shortName: string;
  unit: string;
  decimals: number;
  description: string;
  minRange: number;
  maxRange: number;
}

export const EO_SPATIAL_METRICS: EOMetricOption[] = [
  {
    key: 'sst_celsius',
    label: 'Sea Surface Temperature',
    shortName: 'SST',
    unit: '°C',
    decimals: 1,
    description: 'Absolute Sea Surface Temperature from thermal infrared sensors (INSAT-3D/Oceansat)',
    minRange: 26.0,
    maxRange: 32.0,
  },
  {
    key: 'chlorophyll_a_mg_m3',
    label: 'Chlorophyll-a',
    shortName: 'Chl-a',
    unit: 'mg/m³',
    decimals: 2,
    description: 'Surface Chlorophyll-a concentration from ocean color radiometry (Oceansat-3 OCM)',
    minRange: 0.2,
    maxRange: 3.0,
  },
  {
    key: 'cloud_cover_pct',
    label: 'Cloud Cover',
    shortName: 'Cloud Cover',
    unit: '%',
    decimals: 0,
    description: 'Pixel cloud fraction percentage across 5×5 satellite grid cells',
    minRange: 0,
    maxRange: 100,
  },
];

export interface EOSpatialStats {
  validCount: number;
  totalCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  cloudObscuredCount: number;
  degradedCount: number;
}

/**
 * Pure helper: Computes spatial statistics (min, max, arithmetic mean across valid cells)
 * strictly ignoring null, NaN, and cloud-obscured/invalid observations.
 */
export function calculateEOSpatialStats(
  cells: EOGridCell[],
  metricKey: EOMetricKey
): EOSpatialStats {
  let validCount = 0;
  let cloudObscuredCount = 0;
  let degradedCount = 0;
  const values: number[] = [];

  for (const c of cells || []) {
    const qc = c.qc_status || 'VALID';
    if (qc === 'CLOUD_OBSCURED') {
      cloudObscuredCount++;
    } else if (qc === 'DEGRADED_QC_WARNING' || qc === 'SUSPECT') {
      degradedCount++;
    }

    const val = c[metricKey];
    if (typeof val === 'number' && !isNaN(val) && qc === 'VALID') {
      values.push(val);
      validCount++;
    }
  }

  const totalCount = (cells || []).length;
  if (values.length === 0) {
    return {
      validCount: 0,
      totalCount,
      min: null,
      max: null,
      mean: null,
      cloudObscuredCount,
      degradedCount,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = +(sum / values.length).toFixed(2);

  return {
    validCount,
    totalCount,
    min,
    max,
    mean,
    cloudObscuredCount,
    degradedCount,
  };
}

/**
 * Pure helper: Computes continuous deterministic color scale for a given metric and value.
 */
export function getEOCellColor(
  metricKey: EOMetricKey,
  value: number | null | undefined,
  qcStatus: string | undefined,
  minBound: number,
  maxBound: number
): string {
  if (qcStatus === 'CLOUD_OBSCURED') {
    return '#64748b'; // Translucent/cloud slate
  }
  if (qcStatus === 'DEGRADED_QC_WARNING' || qcStatus === 'SUSPECT') {
    return '#f59e0b'; // Degraded amber
  }
  if (value === null || value === undefined || isNaN(value)) {
    return '#334155'; // Dark slate for NO_DATA
  }

  const span = Math.max(maxBound - minBound, 0.001);
  const t = Math.max(0, Math.min(1, (value - minBound) / span));

  if (metricKey === 'sst_celsius') {
    // SST: Blue (cool) -> Amber (mid) -> Red (warm)
    if (t < 0.5) {
      const factor = t / 0.5;
      const r = Math.round(59 + (245 - 59) * factor);
      const g = Math.round(130 + (158 - 130) * factor);
      const b = Math.round(246 + (11 - 246) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const factor = (t - 0.5) / 0.5;
      const r = Math.round(245 + (239 - 245) * factor);
      const g = Math.round(158 + (68 - 158) * factor);
      const b = Math.round(11 + (68 - 11) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  if (metricKey === 'chlorophyll_a_mg_m3') {
    // Chl-a: Deep Emerald -> Vibrant Green -> Light Cyan
    if (t < 0.5) {
      const factor = t / 0.5;
      const r = Math.round(6 + (16 - 6) * factor);
      const g = Math.round(95 + (185 - 95) * factor);
      const b = Math.round(70 + (129 - 70) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const factor = (t - 0.5) / 0.5;
      const r = Math.round(16 + (52 - 16) * factor);
      const g = Math.round(185 + (211 - 185) * factor);
      const b = Math.round(129 + (153 - 129) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  // Cloud Cover: Clear sky cyan -> Grey -> Bright Cloud White
  const r = Math.round(2 + (203 - 2) * t);
  const g = Math.round(132 + (213 - 132) * t);
  const b = Math.round(199 + (225 - 199) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Pure data transformation: Converts an array of EO grid cell records for a single date
 * into a GeoJSON FeatureCollection with rich styling and metric attributes.
 */
export function buildEOGridGeoJSON(
  cells: EOGridCell[],
  metricKey: EOMetricKey,
  selectedCellId?: string | null
): GeoJSON.FeatureCollection {
  const metricConfig = EO_SPATIAL_METRICS.find((m) => m.key === metricKey) || EO_SPATIAL_METRICS[0];

  // Derive min/max from valid cells for dynamic scaling or fallback to configured ranges
  const validVals = (cells || [])
    .filter((c) => c.qc_status === 'VALID' && typeof c[metricKey] === 'number')
    .map((c) => c[metricKey] as number);

  const minBound = validVals.length > 0 ? Math.min(...validVals) : metricConfig.minRange;
  const maxBound = validVals.length > 0 ? Math.max(...validVals) : metricConfig.maxRange;

  const validFeatures = (cells || [])
    .filter(
      (c) =>
        typeof c.center_lat === 'number' &&
        typeof c.center_lon === 'number' &&
        !isNaN(c.center_lat) &&
        !isNaN(c.center_lon) &&
        (c.center_lat !== 0 || c.center_lon !== 0) &&
        c.center_lat >= -90 &&
        c.center_lat <= 90 &&
        c.center_lon >= -180 &&
        c.center_lon <= 180
    )
    .map((c) => {
      const val = c[metricKey];
      const isSelected = !!selectedCellId && (c.cell_id === selectedCellId || c.public_id === selectedCellId);
      const color = getEOCellColor(metricKey, val, c.qc_status, minBound, maxBound);

      let formattedValue = '—';
      if (typeof val === 'number') {
        formattedValue = `${val.toFixed(metricConfig.decimals)} ${metricConfig.unit}`;
      } else if (c.qc_status === 'CLOUD_OBSCURED') {
        formattedValue = 'Cloud Obscured';
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [c.center_lon, c.center_lat],
        },
        properties: {
          public_id: c.public_id || c.cell_id,
          cell_id: c.cell_id,
          center_lat: c.center_lat,
          center_lon: c.center_lon,
          pass_time: c.pass_time,
          sst_celsius: c.sst_celsius,
          chlorophyll_a_mg_m3: c.chlorophyll_a_mg_m3,
          cloud_cover_pct: c.cloud_cover_pct,
          cloud_fraction: c.cloud_fraction,
          uncertainty: c.uncertainty,
          qc_status: c.qc_status || 'VALID',
          satellite: c.satellite,
          resolution_m: c.resolution_m,
          source: c.source,
          metric_key: metricKey,
          metric_value: val,
          formatted_value: formattedValue,
          color,
          is_selected: isSelected,
          label: typeof val === 'number' ? val.toFixed(metricConfig.decimals === 0 ? 0 : 1) : '',
        },
      };
    });

  return {
    type: 'FeatureCollection',
    features: validFeatures,
  };
}

export interface EOGridSpatialMapProps {
  records: EOGridCell[];
  loading?: boolean;
}

export default function EOGridSpatialMap({
  records,
  loading = false,
}: EOGridSpatialMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const isLoadedRef = useRef(false);

  // Available dates extraction (chronological ascending)
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    for (const r of records || []) {
      if (r && r.pass_time) {
        const d = r.pass_time.slice(0, 10);
        if (d && d.length === 10) dates.add(d);
      }
    }
    return Array.from(dates).sort();
  }, [records]);

  // Selected date state (defaults to latest chronological date)
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<EOMetricKey>('sst_celsius');
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  useEffect(() => {
    if (availableDates.length > 0 && (!selectedDate || !availableDates.includes(selectedDate))) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedDate]);

  // Sliced cells for the selected date
  const dateCells = useMemo(() => {
    if (!selectedDate) return [];
    return (records || []).filter(
      (r) => r && r.pass_time && r.pass_time.startsWith(selectedDate)
    );
  }, [records, selectedDate]);

  // Spatial stats for selected date & metric
  const spatialStats = useMemo(
    () => calculateEOSpatialStats(dateCells, selectedMetric),
    [dateCells, selectedMetric]
  );

  // Selected cell record
  const selectedCellRecord = useMemo(() => {
    if (!selectedCellId) return null;
    return dateCells.find((c) => c.cell_id === selectedCellId || c.public_id === selectedCellId) || null;
  }, [dateCells, selectedCellId]);

  // GeoJSON FeatureCollection
  const geojson = useMemo(
    () => buildEOGridGeoJSON(dateCells, selectedMetric, selectedCellId),
    [dateCells, selectedMetric, selectedCellId]
  );

  const activeMetricConfig = useMemo(
    () => EO_SPATIAL_METRICS.find((m) => m.key === selectedMetric) || EO_SPATIAL_METRICS[0],
    [selectedMetric]
  );

  // Format date helper (e.g., "2026-09-12" -> "Sep 12, 2026")
  const formatDateLabel = useCallback((dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'T00:00:00Z');
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return dateStr;
    }
  }, []);

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_DARK,
      center: [72.96, 16.6], // Central 5x5 grid centroid
      zoom: 7.2,
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

      // Add GeoJSON source
      map.addSource('eo-grid-source', {
        type: 'geojson',
        data: geojson,
      });

      // Layer 1: Selection halo ring
      map.addLayer({
        id: 'eo-grid-selection-ring',
        type: 'circle',
        source: 'eo-grid-source',
        paint: {
          'circle-radius': 22,
          'circle-color': 'transparent',
          'circle-stroke-width': [
            'case',
            ['==', ['get', 'is_selected'], true],
            3,
            0,
          ],
          'circle-stroke-color': '#38bdf8',
          'circle-stroke-opacity': 0.9,
        },
      });

      // Layer 2: Main grid cell circles
      map.addLayer({
        id: 'eo-grid-cells-circle',
        type: 'circle',
        source: 'eo-grid-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            10,
            7,
            16,
            10,
            24,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'is_selected'], true],
            '#ffffff',
            '#0f172a',
          ],
        },
      });

      // Layer 3: Cell ID / Value labels inside circles
      map.addLayer({
        id: 'eo-grid-cells-label',
        type: 'symbol',
        source: 'eo-grid-source',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.85)',
          'text-halo-width': 1.5,
        },
      });

      // Interactive popup on hover
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        className: 'eo-map-popup',
      });
      popupRef.current = popup;

      map.on('mouseenter', 'eo-grid-cells-circle', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const geom = feature.geometry as GeoJSON.Point;
        const p = feature.properties as any;

        const dateFormatted = p.pass_time ? p.pass_time.slice(0, 16).replace('T', ' ') + ' UTC' : '—';
        const sstStr = typeof p.sst_celsius === 'number' ? `${p.sst_celsius.toFixed(1)} °C` : '—';
        const chlaStr = typeof p.chlorophyll_a_mg_m3 === 'number' ? `${p.chlorophyll_a_mg_m3.toFixed(2)} mg/m³` : '—';
        const cloudStr = typeof p.cloud_cover_pct === 'number' ? `${p.cloud_cover_pct}%` : '—';
        const uncertStr = typeof p.uncertainty === 'number' ? `±${p.uncertainty.toFixed(2)}` : null;

        popup
          .setLngLat(geom.coordinates as [number, number])
          .setHTML(
            `<div class="eo-spatial-popup-box">
              <div class="eo-spatial-popup-header">
                <span class="eo-spatial-popup-id">${p.cell_id}</span>
                <span class="eo-spatial-popup-qc ${p.qc_status?.toLowerCase()}">${p.qc_status || 'VALID'}</span>
              </div>
              <div class="eo-spatial-popup-time">${dateFormatted}</div>
              <div class="eo-spatial-popup-coords">Lat: ${p.center_lat?.toFixed(2)}°N · Lon: ${p.center_lon?.toFixed(2)}°E</div>
              <div class="eo-spatial-popup-divider"></div>
              <div class="eo-spatial-popup-metrics">
                <div class="eo-spatial-popup-row ${p.metric_key === 'sst_celsius' ? 'highlight' : ''}">
                  <span>SST:</span>
                  <strong>${sstStr}</strong>
                </div>
                <div class="eo-spatial-popup-row ${p.metric_key === 'chlorophyll_a_mg_m3' ? 'highlight' : ''}">
                  <span>Chl-a:</span>
                  <strong>${chlaStr}</strong>
                </div>
                <div class="eo-spatial-popup-row ${p.metric_key === 'cloud_cover_pct' ? 'highlight' : ''}">
                  <span>Cloud:</span>
                  <strong>${cloudStr}</strong>
                </div>
                ${uncertStr ? `<div class="eo-spatial-popup-row uncert"><span>Uncertainty:</span><span>${uncertStr}</span></div>` : ''}
              </div>
              <div class="eo-spatial-popup-footer">${p.satellite || 'Oceansat-3'} · ${p.resolution_m || 360}m</div>
            </div>`
          )
          .addTo(map);
      });

      map.on('mouseleave', 'eo-grid-cells-circle', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      // Cell selection on click
      map.on('click', 'eo-grid-cells-circle', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const cellId = feature.properties?.cell_id || feature.properties?.public_id;
        if (cellId) {
          setSelectedCellId((prev) => (prev === cellId ? null : cellId));
        }
      });
    });

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
    };
  }, []); // Mount once

  // Update map source when geojson changes
  useEffect(() => {
    if (!mapRef.current || !isLoadedRef.current) return;
    const source = mapRef.current.getSource('eo-grid-source') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [geojson]);

  // Fit bounds when date changes or on first valid load
  useEffect(() => {
    if (!mapRef.current || !isLoadedRef.current || geojson.features.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    for (const feat of geojson.features) {
      const coord = (feat.geometry as GeoJSON.Point).coordinates;
      bounds.extend(coord as [number, number]);
    }

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 8.5,
        duration: 800,
      });
    }
  }, [selectedDate]);

  // Date step navigators
  const currentIndex = availableDates.indexOf(selectedDate);
  const handlePrevDate = () => {
    if (currentIndex > 0) {
      setSelectedDate(availableDates[currentIndex - 1]);
    }
  };
  const handleNextDate = () => {
    if (currentIndex < availableDates.length - 1) {
      setSelectedDate(availableDates[currentIndex + 1]);
    }
  };

  const handleResetView = () => {
    if (!mapRef.current || geojson.features.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const feat of geojson.features) {
      const coord = (feat.geometry as GeoJSON.Point).coordinates;
      bounds.extend(coord as [number, number]);
    }
    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 8.5, duration: 600 });
    }
  };

  if (loading) {
    return (
      <div className="ocean-chart-card loading" data-testid="eo-spatial-loading">
        <div className="ocean-chart-header">
          <div className="ocean-chart-title">
            <Satellite size={16} className="ocean-chart-icon" style={{ color: '#0284c7' }} />
            <span>Earth Observation 5×5 Spatial Grid</span>
          </div>
        </div>
        <div className="ocean-chart-empty">
          <Activity size={24} className="researcher-spinner" />
          <span>Loading satellite grid observations…</span>
        </div>
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="ocean-chart-card empty" data-testid="eo-spatial-empty">
        <div className="ocean-chart-header">
          <div className="ocean-chart-title">
            <Satellite size={16} className="ocean-chart-icon" style={{ color: '#0284c7' }} />
            <span>Earth Observation 5×5 Spatial Grid</span>
          </div>
        </div>
        <div className="ocean-chart-empty">
          <AlertTriangle size={24} style={{ color: '#f59e0b', marginBottom: 8 }} />
          <span>Unable to load EO grid observations</span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
            No Earth Observation grid cells are currently available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="eo-spatial-card" data-testid="eo-spatial-grid-map">
      {/* Card Header & Controls Bar */}
      <div className="eo-spatial-header">
        <div className="eo-spatial-title-group">
          <div className="eo-spatial-title">
            <Satellite size={16} style={{ color: '#38bdf8' }} />
            <span>Earth Observation 5×5 Spatial Grid</span>
          </div>
          <span className="eo-spatial-tag">5×5 Grid · 360m Res</span>
        </div>

        {/* Controls: Date Picker & Metric Switcher */}
        <div className="eo-spatial-controls">
          {/* Date Selector */}
          <div className="eo-spatial-date-control">
            <button
              type="button"
              className="eo-date-nav-btn"
              onClick={handlePrevDate}
              disabled={currentIndex <= 0}
              aria-label="Previous observation date"
              title="Previous date"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="eo-date-select-wrap">
              <Calendar size={13} className="eo-date-icon" />
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="eo-date-select"
                aria-label="Select observation date"
                data-testid="eo-date-select"
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDateLabel(d)} ({d})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="eo-date-nav-btn"
              onClick={handleNextDate}
              disabled={currentIndex >= availableDates.length - 1}
              aria-label="Next observation date"
              title="Next date"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Metric Selector Tabs */}
          <div className="eo-metric-tabs" role="tablist" aria-label="Select spatial metric">
            {EO_SPATIAL_METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={selectedMetric === m.key}
                className={`eo-metric-tab-btn ${selectedMetric === m.key ? 'active' : ''}`}
                onClick={() => setSelectedMetric(m.key)}
                data-testid={`eo-metric-btn-${m.key}`}
              >
                {m.shortName}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Spatial KPI Stats Strip */}
      <div className="eo-spatial-kpi-grid">
        <div className="eo-spatial-kpi-card">
          <span className="eo-spatial-kpi-label">Coverage (Selected Slice)</span>
          <div className="eo-spatial-kpi-val">
            <strong>{spatialStats.validCount}</strong>
            <small>/ {spatialStats.totalCount} cells</small>
          </div>
          <span className="eo-spatial-kpi-sub">
            {spatialStats.cloudObscuredCount > 0 ? `${spatialStats.cloudObscuredCount} cloud-obscured` : '100% cloud-free'}
          </span>
        </div>

        <div className="eo-spatial-kpi-card">
          <span className="eo-spatial-kpi-label">Spatial Minimum</span>
          <div className="eo-spatial-kpi-val">
            <strong>{spatialStats.min !== null ? spatialStats.min.toFixed(activeMetricConfig.decimals) : '—'}</strong>
            <small>{activeMetricConfig.unit}</small>
          </div>
          <span className="eo-spatial-kpi-sub">Lowest valid cell</span>
        </div>

        <div className="eo-spatial-kpi-card highlight">
          <span className="eo-spatial-kpi-label">Spatial Mean ({activeMetricConfig.shortName})</span>
          <div className="eo-spatial-kpi-val">
            <strong>{spatialStats.mean !== null ? spatialStats.mean.toFixed(activeMetricConfig.decimals) : '—'}</strong>
            <small>{activeMetricConfig.unit}</small>
          </div>
          <span className="eo-spatial-kpi-sub">Mean across valid EO grid cells</span>
        </div>

        <div className="eo-spatial-kpi-card">
          <span className="eo-spatial-kpi-label">Spatial Maximum</span>
          <div className="eo-spatial-kpi-val">
            <strong>{spatialStats.max !== null ? spatialStats.max.toFixed(activeMetricConfig.decimals) : '—'}</strong>
            <small>{activeMetricConfig.unit}</small>
          </div>
          <span className="eo-spatial-kpi-sub">Highest valid cell</span>
        </div>
      </div>

      {/* Map + Inspector Layout */}
      <div className="eo-spatial-map-wrapper">
        <div className="eo-spatial-map-container" ref={containerRef}>
          {/* Map reset view floating button */}
          <button
            type="button"
            className="eo-map-reset-btn"
            onClick={handleResetView}
            title="Reset map view to grid bounds"
            aria-label="Reset map view"
          >
            <Maximize2 size={13} />
            <span>Fit Grid</span>
          </button>
        </div>

        {/* Selected Cell Inspector Sidebar Card */}
        {selectedCellRecord && (
          <div className="eo-cell-inspector-panel" data-testid="eo-cell-inspector">
            <div className="eo-cell-inspector-header">
              <div className="eo-cell-inspector-title">
                <Satellite size={14} style={{ color: '#38bdf8' }} />
                <span>Cell Inspection: {selectedCellRecord.cell_id}</span>
              </div>
              <button
                type="button"
                className="eo-cell-inspector-close"
                onClick={() => setSelectedCellId(null)}
                aria-label="Close cell inspector"
              >
                <X size={14} />
              </button>
            </div>

            <div className="eo-cell-inspector-body">
              <div className="eo-cell-meta-row">
                <span className="eo-cell-meta-label">Coordinates</span>
                <span className="eo-cell-meta-val mono">
                  {selectedCellRecord.center_lat?.toFixed(3)}°N, {selectedCellRecord.center_lon?.toFixed(3)}°E
                </span>
              </div>
              <div className="eo-cell-meta-row">
                <span className="eo-cell-meta-label">Observation Date</span>
                <span className="eo-cell-meta-val">
                  {selectedCellRecord.pass_time ? selectedCellRecord.pass_time.slice(0, 16).replace('T', ' ') + ' UTC' : '—'}
                </span>
              </div>
              <div className="eo-cell-meta-row">
                <span className="eo-cell-meta-label">QC Status</span>
                <span className={`eo-cell-qc-badge ${selectedCellRecord.qc_status?.toLowerCase()}`}>
                  {selectedCellRecord.qc_status || 'VALID'}
                </span>
              </div>

              <div className="eo-cell-metrics-grid">
                <div className={`eo-cell-metric-box ${selectedMetric === 'sst_celsius' ? 'active' : ''}`}>
                  <span className="box-label">SST</span>
                  <span className="box-val">
                    {selectedCellRecord.sst_celsius !== null ? `${selectedCellRecord.sst_celsius.toFixed(1)} °C` : 'Obscured'}
                  </span>
                </div>
                <div className={`eo-cell-metric-box ${selectedMetric === 'chlorophyll_a_mg_m3' ? 'active' : ''}`}>
                  <span className="box-label">Chl-a</span>
                  <span className="box-val">
                    {selectedCellRecord.chlorophyll_a_mg_m3 !== null ? `${selectedCellRecord.chlorophyll_a_mg_m3.toFixed(2)} mg/m³` : 'Obscured'}
                  </span>
                </div>
                <div className={`eo-cell-metric-box ${selectedMetric === 'cloud_cover_pct' ? 'active' : ''}`}>
                  <span className="box-label">Cloud</span>
                  <span className="box-val">
                    {selectedCellRecord.cloud_cover_pct !== null ? `${selectedCellRecord.cloud_cover_pct}%` : '—'}
                  </span>
                </div>
              </div>

              {typeof selectedCellRecord.uncertainty === 'number' && (
                <div className="eo-cell-meta-row" style={{ marginTop: 8 }}>
                  <span className="eo-cell-meta-label">Measurement Uncertainty</span>
                  <span className="eo-cell-meta-val mono">±{selectedCellRecord.uncertainty.toFixed(3)}</span>
                </div>
              )}

              <div className="eo-cell-meta-row">
                <span className="eo-cell-meta-label">Sensor & Resolution</span>
                <span className="eo-cell-meta-val">
                  {selectedCellRecord.satellite || 'Oceansat-3'} ({selectedCellRecord.resolution_m}m)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Footer: Color Gradient Legend + QC Legend + Provenance Disclosure */}
      <div className="eo-spatial-footer">
        {/* Metric Color Bar Legend */}
        <div className="eo-spatial-legend-section">
          <div className="eo-legend-title">
            <span>{activeMetricConfig.label} ({activeMetricConfig.unit})</span>
          </div>
          <div className="eo-legend-bar-wrap">
            <span className="eo-legend-bound">
              {spatialStats.min !== null ? `${spatialStats.min.toFixed(activeMetricConfig.decimals)}` : `${activeMetricConfig.minRange}`}
            </span>
            <div
              className={`eo-legend-gradient-bar ${selectedMetric}`}
              style={{
                background:
                  selectedMetric === 'sst_celsius'
                    ? 'linear-gradient(to right, rgb(59, 130, 246), rgb(245, 158, 11), rgb(239, 68, 68))'
                    : selectedMetric === 'chlorophyll_a_mg_m3'
                    ? 'linear-gradient(to right, rgb(6, 95, 70), rgb(16, 185, 129), rgb(52, 211, 153))'
                    : 'linear-gradient(to right, rgb(2, 132, 199), rgb(100, 116, 139), rgb(203, 213, 225))',
              }}
            />
            <span className="eo-legend-bound">
              {spatialStats.max !== null ? `${spatialStats.max.toFixed(activeMetricConfig.decimals)}` : `${activeMetricConfig.maxRange}`}
            </span>
          </div>
        </div>

        {/* QC Status Legend */}
        <div className="eo-qc-legend-section">
          <span className="eo-legend-title">QC Status Encoding</span>
          <div className="eo-qc-badges-list">
            <span className="eo-qc-item">
              <span className="eo-qc-dot valid" /> Valid Observation
            </span>
            <span className="eo-qc-item">
              <span className="eo-qc-dot cloud" /> Cloud Obscured
            </span>
            <span className="eo-qc-item">
              <span className="eo-qc-dot degraded" /> Degraded / Warning
            </span>
            <span className="eo-qc-item">
              <span className="eo-qc-dot nodata" /> No Data
            </span>
          </div>
        </div>
      </div>

      {/* Provenance Caption */}
      <div className="eo-spatial-caption">
        <Info size={12} style={{ flexShrink: 0, marginTop: 1, color: '#38bdf8' }} />
        <span>
          MOSDAC/EO-style daily observations · 5×5 synthetic spatial grid ({formatDateLabel(selectedDate)}) · Discrete cell snapshot measurements; no spatial interpolation or raster interpolation applied.
        </span>
      </div>
    </div>
  );
}
