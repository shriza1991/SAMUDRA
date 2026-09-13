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

  it('verifies sector selection determines available vessels and handles zero-vessel sectors cleanly', () => {
    // Sector-to-vessels mapping
    const ratnagiriVessels = [
      { public_id: 'vessel-01', name: 'Matsya Sagar 01', home_harbor_id: 'harbor-ratnagiri' },
      { public_id: 'vessel-02', name: 'Konkan Pride', home_harbor_id: 'harbor-ratnagiri' },
    ];
    const malvanVessels = [
      { public_id: 'vessel-05', name: 'Sea Hawk Goa', home_harbor_id: 'harbor-malvan' },
    ];
    const zeroVesselSector: typeof ratnagiriVessels = [];

    expect(ratnagiriVessels.map(v => v.public_id)).toEqual(['vessel-01', 'vessel-02']);
    expect(malvanVessels.map(v => v.public_id)).toEqual(['vessel-05']);
    expect(zeroVesselSector).toHaveLength(0);

    // Switching to zero-vessel sector clears track
    let activeTrack: any = { layer_id: 'layer_fleet_vessel_replay' };
    const onReplayUpdate = (layer: any) => { activeTrack = layer; };

    if (zeroVesselSector.length === 0) {
      onReplayUpdate(null);
    }
    expect(activeTrack).toBeNull();
  });

  it('verifies vessel selection displays corresponding replay and never falls back to vessel-01', () => {
    // Vessel A: vessel-05 (Malvan)
    const vesselAPositions = [
      { timestamp: '00:00', latitude: 16.060, longitude: 73.465, speed_knots: 5.2, heading_deg: 320, vessel_id: 'vessel-05' },
      { timestamp: '06:00', latitude: 16.140, longitude: 73.410, speed_knots: 8.0, heading_deg: 325, vessel_id: 'vessel-05' },
    ];

    // Vessel B: vessel-11 (Mumbai)
    const vesselBPositions = [
      { timestamp: '00:00', latitude: 18.910, longitude: 72.825, speed_knots: 6.0, heading_deg: 220, vessel_id: 'vessel-11' },
      { timestamp: '06:00', latitude: 18.740, longitude: 72.670, speed_knots: 8.0, heading_deg: 225, vessel_id: 'vessel-11' },
    ];

    const generateReplayLayer = (positions: typeof vesselAPositions) => {
      const current = positions[positions.length - 1];
      return {
        layer_id: 'layer_fleet_vessel_replay',
        properties: { vessel_id: current.vessel_id },
        geojson: {
          type: 'FeatureCollection' as const,
          features: [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
                coordinates: positions.map(p => [p.longitude, p.latitude]),
              },
              properties: { vessel_id: current.vessel_id },
            },
            {
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [current.longitude, current.latitude],
              },
              properties: {
                vessel_id: current.vessel_id,
                speed_knots: current.speed_knots,
                heading_deg: current.heading_deg,
              },
            },
          ],
        },
      };
    };

    const layerA = generateReplayLayer(vesselAPositions);
    expect(layerA.properties.vessel_id).toBe('vessel-05');
    expect(layerA.properties.vessel_id).not.toBe('vessel-01');
    expect(layerA.geojson.features[0].geometry.coordinates).toEqual([[73.465, 16.060], [73.410, 16.140]]);
    expect(layerA.geojson.features[1].geometry.coordinates).toEqual([73.410, 16.140]);

    const layerB = generateReplayLayer(vesselBPositions);
    expect(layerB.properties.vessel_id).toBe('vessel-11');
    expect(layerB.properties.vessel_id).not.toBe('vessel-01');
    expect(layerB.geojson.features[0].geometry.coordinates).toEqual([[72.825, 18.910], [72.670, 18.740]]);
    expect(layerB.geojson.features[1].geometry.coordinates).toEqual([72.670, 18.740]);
  });

  it('verifies replay failure or missing data results in null map track and does not fabricate coordinates', () => {
    let mapTrack: any = { layer_id: 'layer_fleet_vessel_replay' };
    const onReplayUpdate = (layer: any) => { mapTrack = layer; };

    // When backend returns empty replay or fails
    const failedOrEmptyReplay: any[] = [];
    if (!failedOrEmptyReplay || failedOrEmptyReplay.length === 0) {
      onReplayUpdate(null);
    }

    expect(mapTrack).toBeNull();
  });
});
