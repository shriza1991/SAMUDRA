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
});
