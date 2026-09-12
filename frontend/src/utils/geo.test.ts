import { describe, it, expect } from 'vitest';
import {
  HARBOR_COORDINATES,
  getHarborCoordinates,
  createHarborLayer,
  SECTOR_SURVEILLANCE_CONFIGS,
  getSectorConfig,
  createSectorLayers,
} from './geo';

describe('Geospatial Utilities & Baseline Situational Layers', () => {
  it('resolves canonical harbor coordinates accurately', () => {
    expect(getHarborCoordinates('Ratnagiri')).toEqual([73.28, 16.99]);
    expect(getHarborCoordinates('Mumbai')).toEqual([72.87, 18.92]);
    expect(getHarborCoordinates('Malvan')).toEqual([73.47, 16.06]);
    expect(getHarborCoordinates('Panaji')).toEqual([73.83, 15.49]);
    expect(getHarborCoordinates('Veraval')).toEqual([70.37, 20.90]);
    expect(getHarborCoordinates('Porbandar')).toEqual([69.60, 21.64]);
    // Case-insensitive fallback
    expect(getHarborCoordinates('mumbai')).toEqual([72.87, 18.92]);
    expect(getHarborCoordinates(undefined)).toEqual(HARBOR_COORDINATES.Ratnagiri);
  });

  it('generates valid GeoJSON MapLayer for departure harbors', () => {
    const layer = createHarborLayer('Malvan', 'GO');
    expect(layer.layer_id).toBe('layer_harbor_malvan');
    expect(layer.name).toContain('Malvan');
    expect(layer.layer_type).toBe('geojson');
    expect(layer.geojson.type).toBe('Feature');
    expect(layer.geojson.geometry.coordinates).toEqual([73.47, 16.06]);
    expect(layer.style?.color).toBe('#0ea5e9');

    const noGoLayer = createHarborLayer('Ratnagiri', 'NO_GO');
    expect(noGoLayer.style?.color).toBe('#ef4444');
  });

  it('resolves authority surveillance sector configs and polygons', () => {
    const config = getSectorConfig('Malvan Marine Zone (MH-04)');
    expect(config.center).toEqual([73.47, 16.06]);
    expect(config.label).toContain('Malvan');
    expect(config.polygon.length).toBeGreaterThanOrEqual(4);

    const fallbackConfig = getSectorConfig('Unknown Sector');
    expect(fallbackConfig).toEqual(SECTOR_SURVEILLANCE_CONFIGS['Ratnagiri Sector (MH-03)']);
  });

  it('generates sector polygon and surveillance station layers', () => {
    const layers = createSectorLayers('Goa Naval Corridor (GA-01)');
    expect(layers).toHaveLength(2);

    const [polygonLayer, stationLayer] = layers;
    expect(polygonLayer.geojson.type).toBe('FeatureCollection');
    expect(polygonLayer.style?.color).toBe('#a855f7');
    expect(polygonLayer.geojson.features?.[0]?.geometry.type).toBe('Polygon');

    expect(stationLayer.geojson.type).toBe('Feature');
    expect(stationLayer.geojson.geometry.type).toBe('Point');
    expect(stationLayer.geojson.geometry.coordinates).toEqual([73.83, 15.49]);
  });
});
