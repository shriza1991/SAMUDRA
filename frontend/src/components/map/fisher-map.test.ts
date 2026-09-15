import { describe, it, expect } from 'vitest';
import type { MapLayer } from '../../types/contracts';
import type { PFZCandidate, HazardBulletin } from '../../api/researcher-client';
import {
  createPFZMapLayers,
  createHazardMapLayers,
  mergeFisherLayers,
  formatFishermanPopup,
} from '../../utils/fisher-map';
import { createHarborLayer, createAuthorityRouteLayers } from '../../utils/geo';

describe('P0-23 Fisherman Interactive Decision Map Utilities & Contracts', () => {
  const mockCandidates: PFZCandidate[] = [
    {
      public_id: 'pfz-01',
      latitude: 16.82,
      longitude: 72.95,
      sst_gradient: 0.45,
      chlorophyll_a_mg_m3: 1.25,
      depth_m: 45,
      distance_km: 36.4,
      bearing_deg: 250,
      rank: 1,
      status: 'ACTIVE',
      confidence: 'HIGH',
      valid_from: '2026-09-15T00:00:00Z',
      valid_to: '2026-09-15T23:59:59Z',
      source: 'INCOIS PFZ Advisory',
    },
    {
      public_id: 'pfz-02',
      latitude: 16.75,
      longitude: 72.88,
      sst_gradient: 0.32,
      chlorophyll_a_mg_m3: 0.95,
      depth_m: 60,
      distance_km: 48.1,
      bearing_deg: 240,
      rank: 2,
      status: 'ACTIVE',
      confidence: 'MEDIUM',
      valid_from: '2026-09-15T00:00:00Z',
      valid_to: '2026-09-15T23:59:59Z',
      source: 'INCOIS PFZ Advisory',
    },
  ];

  const mockHazards: HazardBulletin[] = [
    {
      public_id: 'hazard-01',
      headline: 'Squall Line Warning',
      event_type: 'SQUALL',
      severity: 'WARNING',
      status: 'ACTIVE',
      issued_at: '2026-09-15T06:00:00Z',
      valid_until: '2026-09-15T18:00:00Z',
      source: 'IMD Coastal Bulletin',
      affected_area: 'Ratnagiri Offshore',
      description: 'Wind gusts exceeding 35 knots with rough seas.',
      geometry_geojson: {
        type: 'Polygon',
        coordinates: [
          [
            [72.5, 16.5],
            [73.2, 16.5],
            [73.2, 17.2],
            [72.5, 17.2],
            [72.5, 16.5],
          ],
        ],
      },
    },
  ];

  const mockRoutes = [
    {
      route_id: 'ROUTE-A-INSHORE',
      name: 'Inshore Sheltered Channel',
      distance_km: 26.5,
      max_wave_height_m: 1.3,
      risk_rating: 'LOW',
      exposure_score: 2.1,
      waypoints: [
        [73.28, 16.99],
        [73.2, 16.95],
      ] as [number, number][],
    },
    {
      route_id: 'ROUTE-B-DIRECT',
      name: 'Direct Open-Sea Passage',
      distance_km: 20.2,
      max_wave_height_m: 2.2,
      risk_rating: 'MODERATE',
      exposure_score: 4.5,
      waypoints: [
        [73.28, 16.99],
        [73.1, 16.92],
      ] as [number, number][],
    },
  ];

  it('1. converts PFZ candidates into map layers preserving SST gradient without fabricating °C', () => {
    const layers = createPFZMapLayers(mockCandidates);
    expect(layers).toHaveLength(1);

    const layer = layers[0];
    expect(layer.layer_id).toBe('layer_pfz_candidates');
    expect(layer.style?.layer_category).toBe('pfz');
    expect(layer.style?.color).toBe('#10b981');

    const fc = layer.geojson as GeoJSON.FeatureCollection;
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(2);

    const f1 = fc.features[0];
    expect(f1.properties?.public_id).toBe('pfz-01');
    expect(f1.properties?.sst_gradient).toBe(0.45);
    expect(f1.properties?.confidence).toBe('HIGH');
    expect(f1.geometry.type).toBe('Point');
    expect((f1.geometry as GeoJSON.Point).coordinates).toEqual([72.95, 16.82]);
  });

  it('2. converts Hazard bulletins into map layers preserving backend status', () => {
    const layers = createHazardMapLayers(mockHazards);
    expect(layers).toHaveLength(1);

    const layer = layers[0];
    expect(layer.layer_id).toBe('layer_marine_hazards');
    expect(layer.style?.layer_category).toBe('hazard');

    const fc = layer.geojson as GeoJSON.FeatureCollection;
    expect(fc.features).toHaveLength(1);
    const f1 = fc.features[0];
    expect(f1.properties?.public_id).toBe('hazard-01');
    expect(f1.properties?.severity).toBe('WARNING');
    expect(f1.properties?.status).toBe('ACTIVE');
    expect(f1.properties?.is_active).toBe(true);
    expect(f1.geometry.type).toBe('Polygon');
  });

  it('3. merges baseline and chat response layers with strict de-duplication', () => {
    const baselineRoutes = createAuthorityRouteLayers(mockRoutes, 'ROUTE-A-INSHORE', 'Ratnagiri', 'Outer Bank');
    const baselinePFZ = createPFZMapLayers(mockCandidates);
    const baselineHazards = createHazardMapLayers(mockHazards);

    // Initial state: No chat response layers yet -> baseline layers are active
    const mergedInitial = mergeFisherLayers({
      baseLayers: [],
      harborCoords: [73.28, 16.99],
      originHarbor: 'Ratnagiri',
      status: 'UNKNOWN',
      baselineRoutes,
      baselinePFZ,
      baselineHazards,
      chatLayers: [],
    });

    expect(mergedInitial.some((l) => l.layer_id.includes('harbor'))).toBe(true);
    expect(mergedInitial.some((l) => l.layer_id === 'layer_recommended_route')).toBe(true);
    expect(mergedInitial.some((l) => l.layer_id === 'layer_pfz_candidates')).toBe(true);
    expect(mergedInitial.some((l) => l.layer_id === 'layer_marine_hazards')).toBe(true);

    // When chat response returns its own route and hazard layers:
    const chatRouteLayer: MapLayer = {
      layer_id: 'layer_recommended_route',
      name: 'Chat Mission Route',
      layer_type: 'geojson',
      visible: true,
      geojson: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[73.28, 16.99], [73.0, 16.8]] },
        properties: { route_id: 'CHAT-ROUTE-1', name: 'Chat Route' },
      },
    };

    const mergedWithChat = mergeFisherLayers({
      baseLayers: [],
      harborCoords: [73.28, 16.99],
      originHarbor: 'Ratnagiri',
      status: 'GO',
      baselineRoutes,
      baselinePFZ,
      baselineHazards,
      chatLayers: [chatRouteLayer],
    });

    // Chat route must override baseline route without duplicating
    const routeLayers = mergedWithChat.filter((l) => l.layer_id === 'layer_recommended_route');
    expect(routeLayers).toHaveLength(1);
    expect((routeLayers[0].geojson as any).properties.route_id).toBe('CHAT-ROUTE-1');
  });

  it('4. formats mariner-focused popups for harbor, PFZ, hazard, and route features', () => {
    // Harbor popup
    const harborFeature = {
      properties: {
        type: 'Departure Harbor Station',
        harbor: 'Ratnagiri',
        operational_status: 'GO',
        coordinates: '16.99°N, 73.28°E',
      },
    };
    const harborHtml = formatFishermanPopup(harborFeature, createHarborLayer('Ratnagiri', 'GO'));
    expect(harborHtml).toContain('Ratnagiri');
    expect(harborHtml).toContain('SAFE TO GO');
    expect(harborHtml).toContain('16.99°N, 73.28°E');

    // PFZ popup
    const pfzFeature = {
      properties: {
        public_id: 'pfz-01',
        rank: 1,
        confidence: 'HIGH',
        sst_gradient: 0.45,
        depth_m: 45,
        distance_km: 36.4,
        bearing_deg: 250,
      },
    };
    const pfzHtml = formatFishermanPopup(pfzFeature, { layer_id: 'layer_pfz_candidates', name: 'PFZ', layer_type: 'geojson', visible: true, geojson: {} as any });
    expect(pfzHtml).toContain('PFZ Candidate #1');
    expect(pfzHtml).toContain('HIGH CONFIDENCE');
    expect(pfzHtml).toContain('0.45');
    expect(pfzHtml).toContain('45 m');
    expect(pfzHtml).toContain('36.4 km');

    // Hazard popup
    const hazardFeature = {
      properties: {
        headline: 'Squall Warning',
        severity: 'WARNING',
        status: 'ACTIVE',
        affected_area: 'Ratnagiri Coast',
        description: 'Gusts up to 40kt',
      },
    };
    const hazardHtml = formatFishermanPopup(hazardFeature, { layer_id: 'layer_marine_hazards', name: 'Hazard', layer_type: 'geojson', visible: true, geojson: {} as any });
    expect(hazardHtml).toContain('Squall Warning');
    expect(hazardHtml).toContain('WARNING');
    expect(hazardHtml).toContain('ACTIVE');
    expect(hazardHtml).toContain('Ratnagiri Coast');

    // Route popup
    const routeFeature = {
      properties: {
        route_id: 'ROUTE-A-INSHORE',
        name: 'Inshore Route',
        distance_km: 26.5,
        max_wave_height_m: 1.3,
        risk_rating: 'LOW',
        exposure_score: 2.1,
      },
    };
    const routeHtml = formatFishermanPopup(routeFeature, { layer_id: 'layer_recommended_route', name: 'Route', layer_type: 'geojson', visible: true, geojson: {} as any });
    expect(routeHtml).toContain('Inshore Route');
    expect(routeHtml).toContain('26.5 km');
    expect(routeHtml).toContain('1.3 m');
    expect(routeHtml).toContain('LOW RISK');
  });

  it('5. preserves partial availability on layer failures without cascading collapse', () => {
    // Scenario: Routes fail (empty), but PFZ and Hazards are available
    const mergedNoRoutes = mergeFisherLayers({
      baseLayers: [],
      harborCoords: [73.28, 16.99],
      originHarbor: 'Ratnagiri',
      status: 'UNKNOWN',
      baselineRoutes: [],
      baselinePFZ: createPFZMapLayers(mockCandidates),
      baselineHazards: createHazardMapLayers(mockHazards),
      chatLayers: [],
    });

    expect(mergedNoRoutes.some((l) => l.layer_id === 'layer_pfz_candidates')).toBe(true);
    expect(mergedNoRoutes.some((l) => l.layer_id === 'layer_marine_hazards')).toBe(true);
    expect(mergedNoRoutes.some((l) => l.layer_id === 'layer_recommended_route')).toBe(false);

    // Scenario: PFZ fails (empty), but Routes and Hazards are available
    const mergedNoPFZ = mergeFisherLayers({
      baseLayers: [],
      harborCoords: [73.28, 16.99],
      originHarbor: 'Ratnagiri',
      status: 'UNKNOWN',
      baselineRoutes: createAuthorityRouteLayers(mockRoutes, 'ROUTE-A-INSHORE'),
      baselinePFZ: [],
      baselineHazards: createHazardMapLayers(mockHazards),
      chatLayers: [],
    });

    expect(mergedNoPFZ.some((l) => l.layer_id === 'layer_recommended_route')).toBe(true);
    expect(mergedNoPFZ.some((l) => l.layer_id === 'layer_marine_hazards')).toBe(true);
    expect(mergedNoPFZ.some((l) => l.layer_id === 'layer_pfz_candidates')).toBe(false);
  });
});
