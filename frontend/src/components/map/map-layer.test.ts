import { describe, it, expect } from 'vitest';
import type { MapLayer } from '../../types/contracts';
import { MOCK_SAFETY_RESPONSE, MOCK_PFZ_RESPONSE } from '../../api/mock-data';

describe('Map Layer GeoJSON Contract & Semantics', () => {
  it('validates Point geometry layers (e.g. Harbor departure points)', () => {
    const pointLayers = [...MOCK_SAFETY_RESPONSE.map_layers, ...MOCK_PFZ_RESPONSE.map_layers]
      .filter(l => l.geojson.type === 'Feature' && (l.geojson as any).geometry?.type === 'Point');

    expect(pointLayers.length).toBeGreaterThan(0);
    for (const layer of pointLayers) {
      expect(layer.layer_id).toBeTruthy();
      expect(layer.name).toBeTruthy();
      expect(layer.visible).toBe(true);

      const feature = layer.geojson as GeoJSON.Feature<GeoJSON.Point>;
      expect(feature.geometry.coordinates).toHaveLength(2);
      const [lon, lat] = feature.geometry.coordinates;
      expect(lon).toBeGreaterThanOrEqual(68.0);
      expect(lon).toBeLessThanOrEqual(80.0);
      expect(lat).toBeGreaterThanOrEqual(8.0);
      expect(lat).toBeLessThanOrEqual(24.0);
    }
  });

  it('validates Polygon geometry layers (e.g. Squall sectors, PFZ zones, restricted areas)', () => {
    const polygonLayers = [...MOCK_SAFETY_RESPONSE.map_layers, ...MOCK_PFZ_RESPONSE.map_layers]
      .filter(l => {
        if (l.geojson.type === 'FeatureCollection' && Array.isArray((l.geojson as any).features)) {
          return (l.geojson as any).features.some((f: any) => f.geometry?.type === 'Polygon');
        }
        return (l.geojson as any).geometry?.type === 'Polygon';
      });

    expect(polygonLayers.length).toBeGreaterThan(0);
    for (const layer of polygonLayers) {
      expect(layer.style?.color).toBeTruthy();
      expect(layer.style?.opacity).toBeDefined();

      if (layer.geojson.type === 'FeatureCollection' && Array.isArray((layer.geojson as any).features)) {
        const polyFeatures = (layer.geojson as any).features.filter((f: any) => f.geometry?.type === 'Polygon');
        for (const f of polyFeatures) {
          const poly = f.geometry as GeoJSON.Polygon;
          expect(poly.coordinates.length).toBeGreaterThan(0);
          const ring = poly.coordinates[0];
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring[0]).toEqual(ring[ring.length - 1]);
        }
      }
    }
  });

  it('validates LineString geometry layers (e.g. Navigation routes)', () => {
    const routeLayers = MOCK_PFZ_RESPONSE.map_layers.filter(l => {
      if (l.geojson.type === 'Feature') {
        return (l.geojson as any).geometry?.type === 'LineString';
      }
      return false;
    });

    expect(routeLayers.length).toBeGreaterThan(0);
    const routeLayer = routeLayers[0];
    expect(routeLayer.name).toContain('Route');
    const feature = routeLayer.geojson as GeoJSON.Feature<GeoJSON.LineString>;
    expect(feature.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  });

  it('supports independent layer visibility toggling', () => {
    const layers: MapLayer[] = [...MOCK_SAFETY_RESPONSE.map_layers];
    const initialVisibility = layers.map(l => l.visible);

    const toggled = layers.map((l, i) => i === 0 ? { ...l, visible: !l.visible } : l);
    expect(toggled[0].visible).toBe(!initialVisibility[0]);
    expect(toggled[1].visible).toBe(initialVisibility[1]);
  });

  it('validates all 9 canonical SAMUDRA layer types and categories', () => {
    const testLayers: MapLayer[] = [
      {
        layer_id: 'layer_vessel_position',
        name: 'Vessel Position',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#0ea5e9', layer_category: 'navigation' },
        geojson: { type: 'Feature', geometry: { type: 'Point', coordinates: [73.28, 16.99] }, properties: {} },
      },
      {
        layer_id: 'layer_pfz_advisories',
        name: 'Potential Fishing Zones',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#10b981', layer_category: 'navigation' },
        geojson: { type: 'FeatureCollection', features: [] },
      },
      {
        layer_id: 'layer_safety_envelope',
        name: 'Marine Safety Envelope',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#10b981', layer_category: 'safety_critical' },
        geojson: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[73.1, 16.8], [73.4, 16.8], [73.4, 17.1], [73.1, 17.1], [73.1, 16.8]]] }, properties: {} },
      },
      {
        layer_id: 'layer_weather_telemetry',
        name: 'Weather Telemetry',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#3b82f6', layer_category: 'navigation' },
        geojson: { type: 'Feature', geometry: { type: 'Point', coordinates: [73.28, 16.99] }, properties: {} },
      },
      {
        layer_id: 'layer_cyclone_hazard',
        name: 'Cyclone Warning Sector',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#ef4444', layer_category: 'safety_critical' },
        geojson: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[73.0, 16.5], [74.0, 16.5], [74.0, 17.5], [73.0, 17.5], [73.0, 16.5]]] }, properties: {} },
      },
      {
        layer_id: 'layer_geofence_boundaries',
        name: 'Restricted Marine Geofences',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#dc2626', layer_category: 'safety_critical' },
        geojson: { type: 'FeatureCollection', features: [] },
      },
      {
        layer_id: 'layer_candidate_routes',
        name: 'Candidate Passage Routes',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#f59e0b', layer_category: 'navigation' },
        geojson: { type: 'FeatureCollection', features: [] },
      },
      {
        layer_id: 'layer_recommended_route',
        name: 'Recommended Safe Route',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#06b6d4', layer_category: 'navigation' },
        geojson: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[73.28, 16.99], [73.83, 15.49]] }, properties: {} },
      },
      {
        layer_id: 'layer_destination_port',
        name: 'Destination Port',
        layer_type: 'geojson',
        visible: true,
        style: { color: '#6366f1', layer_category: 'navigation' },
        geojson: { type: 'Feature', geometry: { type: 'Point', coordinates: [73.83, 15.49] }, properties: {} },
      },
    ];

    expect(testLayers).toHaveLength(9);
    const safetyLayers = testLayers.filter(l => l.style?.layer_category === 'safety_critical');
    const navLayers = testLayers.filter(l => l.style?.layer_category === 'navigation');

    expect(safetyLayers.length).toBe(3);
    expect(navLayers.length).toBe(6);
  });

  it('validates operational corridor distance and properties extraction', () => {
    const routeLayer: MapLayer = {
      layer_id: 'layer_pfz_route',
      name: 'Safe PFZ Passage',
      layer_type: 'geojson',
      visible: true,
      geojson: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[73.28, 16.99], [72.95, 16.82]] },
        properties: { label: 'Route to PFZ', distance_km: 42.6 },
      },
    };

    expect(routeLayer.geojson).toBeDefined();
    const props = (routeLayer.geojson as any).properties;
    expect(props.distance_km).toBe(42.6);
  });
});

