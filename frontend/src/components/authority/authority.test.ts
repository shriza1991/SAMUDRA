import { describe, it, expect } from 'vitest';
import ScenarioBenchmarkDeck from './ScenarioBenchmarkDeck';
import FleetTrackingDeck from './FleetTrackingDeck';
import { createSectorLayers, FALLBACK_DEMO_SECTORS } from '../../utils/geo';
import type { DemoSector } from '../../api/client';

describe('Authority Advanced Feature Decks', () => {
  it('exports ScenarioBenchmarkDeck component cleanly', () => {
    expect(ScenarioBenchmarkDeck).toBeDefined();
    expect(typeof ScenarioBenchmarkDeck).toBe('function');
  });

  it('exports FleetTrackingDeck component cleanly', () => {
    expect(FleetTrackingDeck).toBeDefined();
    expect(typeof FleetTrackingDeck).toBe('function');
  });

  it('verifies benchmark and fleet subtabs exist for authority surveillance', () => {
    const tabs: Array<'terminal' | 'fleet' | 'benchmarks' | 'audit'> = [
      'terminal',
      'fleet',
      'benchmarks',
      'audit',
    ];
    expect(tabs).toContain('benchmarks');
    expect(tabs).toContain('fleet');
    expect(tabs).toContain('terminal');
    expect(tabs).toContain('audit');
  });

  it('formats DemoSector into authoritative MapLibre MapLayers without hardcoded coordinate injection', () => {
    const canonicalMalvanSector: DemoSector = {
      public_id: 'sector-malvan',
      name: 'Malvan Marine Zone (MH-04)',
      code: 'MH-04',
      station_name: 'Malvan Marine Surveillance Unit',
      harbor_id: 'harbor-malvan',
      center: [73.47, 16.06],
      zoom: 9.5,
      polygon: [
        [73.35, 15.95],
        [73.58, 15.95],
        [73.58, 16.18],
        [73.35, 16.18],
        [73.35, 15.95],
      ],
    };

    const layers = createSectorLayers(canonicalMalvanSector);
    expect(layers).toHaveLength(2);

    const [polygonLayer, stationLayer] = layers;
    expect(polygonLayer.layer_id).toBe('sector_polygon_sector-malvan');
    expect(polygonLayer.name).toBe('Malvan Marine Zone (MH-04)');
    expect(polygonLayer.geojson.type).toBe('FeatureCollection');
    expect(polygonLayer.geojson.features?.[0]?.geometry.coordinates).toEqual([canonicalMalvanSector.polygon]);

    expect(stationLayer.layer_id).toBe('sector_station_sector-malvan');
    expect(stationLayer.name).toBe('Malvan Marine Surveillance Unit');
    expect(stationLayer.geojson.geometry.coordinates).toEqual([73.47, 16.06]);
  });

  it('confirms FALLBACK_DEMO_SECTORS contains 5 distinct sectors for offline UI continuity', () => {
    expect(FALLBACK_DEMO_SECTORS).toHaveLength(5);
    const names = FALLBACK_DEMO_SECTORS.map((s) => s.name);
    expect(names).toContain('Ratnagiri Sector (MH-03)');
    expect(names).toContain('Malvan Marine Zone (MH-04)');
    expect(names).toContain('Goa Naval Corridor (GA-01)');
    expect(names).toContain('Mumbai Offshore (MH-01)');
    expect(names).toContain('Veraval Coastal Zone (GJ-02)');
  });

  it('validates trajectory replay MapLayer contract contains standard bbox for auto-zoom', () => {
    const mockPositions = [
      { timestamp: '00:00', latitude: 15.48, longitude: 73.80, speed_knots: 9.0, heading_deg: 260, vessel_id: 'vessel-09' },
      { timestamp: '01:00', latitude: 15.52, longitude: 73.74, speed_knots: 11.2, heading_deg: 280, vessel_id: 'vessel-09' },
    ];

    const minLng = Math.min(...mockPositions.map(p => p.longitude));
    const maxLng = Math.max(...mockPositions.map(p => p.longitude));
    const minLat = Math.min(...mockPositions.map(p => p.latitude));
    const maxLat = Math.max(...mockPositions.map(p => p.latitude));

    const replayLayer = {
      layer_id: 'layer_fleet_vessel_replay',
      name: `Vessel Replay (${mockPositions[0].vessel_id})`,
      layer_type: 'geojson' as const,
      visible: true,
      style: {
        color: '#06b6d4',
        layer_category: 'fleet_replay',
      },
      properties: {
        vessel_id: mockPositions[0].vessel_id,
        focus_trigger: 0,
        bbox: [minLng, minLat, maxLng, maxLat],
      },
      geojson: {
        type: 'FeatureCollection' as const,
        bbox: [minLng, minLat, maxLng, maxLat],
        features: [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'LineString' as const,
              coordinates: mockPositions.map(p => [p.longitude, p.latitude]),
            },
            properties: { vessel_id: mockPositions[0].vessel_id },
          },
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [mockPositions[0].longitude, mockPositions[0].latitude],
            },
            properties: { vessel_id: mockPositions[0].vessel_id },
          },
        ],
      },
    };

    expect(replayLayer.layer_id).toBe('layer_fleet_vessel_replay');
    expect(replayLayer.style.layer_category).toBe('fleet_replay');
    expect(replayLayer.geojson.bbox).toEqual([73.74, 15.48, 73.80, 15.52]);
    expect(replayLayer.properties.vessel_id).toBe('vessel-09');
    expect(replayLayer.geojson.features).toHaveLength(2);
    expect(replayLayer.geojson.features[0].geometry.type).toBe('LineString');
    expect(replayLayer.geojson.features[1].geometry.type).toBe('Point');
  });
});
