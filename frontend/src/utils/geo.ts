import type { MapLayer } from '../types/contracts';
import type { SectorHazard } from '../api/client';
import { getBaseLayers } from '../api/client';

/**
 * Authoritative Indian Coastal Harbor Coordinates [longitude, latitude] (EPSG:4326)
 * Aligned with backend/app/connectors/harbors.py and data/reference/landing_centres.json
 */
export const HARBOR_COORDINATES: Record<string, [number, number]> = {
  Ratnagiri: [73.28, 16.99],
  Malvan: [73.47, 16.06],
  Panaji: [73.83, 15.49],
  Mumbai: [72.87, 18.92],
  Veraval: [70.37, 20.90],
  Porbandar: [69.60, 21.64],
};

export function getHarborCoordinates(harborName?: string): [number, number] {
  if (!harborName) return HARBOR_COORDINATES.Ratnagiri;
  const match = Object.keys(HARBOR_COORDINATES).find(
    (k) => k.toLowerCase() === harborName.trim().toLowerCase()
  );
  return match ? HARBOR_COORDINATES[match] : HARBOR_COORDINATES.Ratnagiri;
}

/**
 * Creates a baseline GeoJSON MapLayer representing the selected Departure Harbor.
 */
export function createHarborLayer(harborName: string, status: string = 'GO'): MapLayer {
  const [lon, lat] = getHarborCoordinates(harborName);
  const color =
    status === 'NO_GO' ? '#ef4444' : status === 'CAUTION' ? '#eab308' : '#0ea5e9';

  return {
    layer_id: `layer_harbor_${harborName.toLowerCase().replace(/\s+/g, '_')}`,
    name: `Departure Station: ${harborName}`,
    layer_type: 'geojson',
    visible: true,
    style: {
      color,
      opacity: 1.0,
      circle_radius: 10,
      layer_category: 'navigation',
    },
    geojson: {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      properties: {
        harbor: harborName,
        label: `${harborName} Departure Station`,
        coordinates: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
        operational_status: status,
        type: 'Departure Harbor Station',
      },
    },
  };
}

import type { DemoSector } from '../api/client';

export interface SectorDefinition {
  center: [number, number];
  zoom: number;
  label: string;
  stationName: string;
  polygon: [number, number][];
  bufferPolygon?: [number, number][];
}

/**
 * DEMO / SYNTHETIC FALLBACK ONLY
 * Used solely for offline dropdown continuity when backend API is unreachable.
 * Never used to fabricate operational telemetry, vessel coordinates, or alerts.
 * Authoritative sector geometry is served dynamically via GET /api/v1/demo/sectors.
 */
export const FALLBACK_DEMO_SECTORS: DemoSector[] = [
  {
    public_id: 'sector-ratnagiri',
    name: 'Ratnagiri Sector (MH-03)',
    code: 'MH-03',
    station_name: 'Ratnagiri Coast Guard & Fisheries Post',
    harbor_id: 'harbor-ratnagiri',
    center: [73.28, 16.99],
    zoom: 8.8,
    polygon: [
      [72.6, 16.5],
      [73.5, 16.5],
      [73.5, 17.5],
      [72.6, 17.5],
      [72.6, 16.5],
    ],
  },
  {
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
  },
  {
    public_id: 'sector-goa',
    name: 'Goa Naval Corridor (GA-01)',
    code: 'GA-01',
    station_name: 'Goa Port & Naval Traffic Center',
    harbor_id: 'harbor-panaji',
    center: [73.83, 15.49],
    zoom: 9.0,
    polygon: [
      [73.4, 15.15],
      [74.05, 15.15],
      [74.05, 15.8],
      [73.4, 15.8],
      [73.4, 15.15],
    ],
  },
  {
    public_id: 'sector-mumbai',
    name: 'Mumbai Offshore (MH-01)',
    code: 'MH-01',
    station_name: 'Mumbai Maritime Rescue Coordination Centre',
    harbor_id: 'harbor-mumbai',
    center: [72.87, 18.92],
    zoom: 8.8,
    polygon: [
      [72.2, 18.5],
      [73.15, 18.5],
      [73.15, 19.35],
      [72.2, 19.35],
      [72.2, 18.5],
    ],
  },
  {
    public_id: 'sector-veraval',
    name: 'Veraval Coastal Zone (GJ-02)',
    code: 'GJ-02',
    station_name: 'Veraval Coastal Police & Fisheries Command',
    harbor_id: 'harbor-veraval',
    center: [70.37, 20.90],
    zoom: 8.5,
    polygon: [
      [69.8, 20.4],
      [70.9, 20.4],
      [70.9, 21.3],
      [69.8, 21.3],
      [69.8, 20.4],
    ],
  },
];

export const SECTOR_SURVEILLANCE_CONFIGS: Record<string, SectorDefinition> = Object.fromEntries(
  FALLBACK_DEMO_SECTORS.map((s) => [
    s.name,
    {
      center: s.center,
      zoom: s.zoom,
      label: s.name,
      stationName: s.station_name,
      polygon: s.polygon,
    },
  ])
);

export function getSectorConfig(sectorName: string): SectorDefinition {
  return SECTOR_SURVEILLANCE_CONFIGS[sectorName] || SECTOR_SURVEILLANCE_CONFIGS['Ratnagiri Sector (MH-03)'];
}

/**
 * Presentation helper: maps a canonical backend DemoSector or sector name to MapLibre MapLayer objects.
 */
export function createSectorLayers(sectorInput: DemoSector | string): MapLayer[] {
  let sector: DemoSector;
  if (typeof sectorInput === 'string') {
    sector = FALLBACK_DEMO_SECTORS.find((s) => s.name === sectorInput) || FALLBACK_DEMO_SECTORS[0];
  } else {
    sector = sectorInput;
  }

  const sectorId = sector.public_id || sector.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const sectorPolygonLayer: MapLayer = {
    layer_id: `sector_polygon_${sectorId}`,
    name: sector.name,
    layer_type: 'geojson',
    visible: true,
    style: {
      color: '#a855f7',
      opacity: 0.25,
      line_width: 2,
      layer_category: 'surveillance',
    },
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [sector.polygon],
          },
          properties: {
            sector: sector.name,
            type: 'Active Maritime Surveillance Sector',
            authority: 'Coastal Security & Fisheries Enforcement',
          },
        },
      ],
    },
  };

  const sectorStationLayer: MapLayer = {
    layer_id: `sector_station_${sectorId}`,
    name: sector.station_name,
    layer_type: 'geojson',
    visible: true,
    style: {
      color: '#c084fc',
      opacity: 1.0,
      circle_radius: 10,
      layer_category: 'surveillance',
    },
    geojson: {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: sector.center,
      },
      properties: {
        station: sector.station_name,
        sector: sector.name,
        type: 'Maritime Command & Radar Station',
        status: 'ACTIVE_SURVEILLANCE',
      },
    },
  };

  return [sectorPolygonLayer, sectorStationLayer];
}

/** Convert canonical Authority hazard geometry into inspectable MapLibre layers. */
export function createAuthorityHazardLayers(hazards: SectorHazard[]): MapLayer[] {
  return hazards.map((hazard) => {
    const color = hazard.severity === 'WARNING'
      ? '#ef4444'
      : hazard.severity === 'ALERT'
      ? '#f97316'
      : '#eab308';

    return {
      layer_id: `authority_hazard_${hazard.hazard_id}`,
      name: hazard.headline,
      layer_type: 'geojson',
      visible: true,
      style: {
        color,
        opacity: 0.32,
        line_width: 2.5,
        layer_category: 'authority_hazard',
      },
      geojson: {
        type: 'Feature',
        geometry: hazard.geometry,
        properties: {
          hazard_id: hazard.hazard_id,
          hazard_type: hazard.hazard_type,
          severity: hazard.severity,
          status: hazard.status,
          valid_from: hazard.valid_from,
          valid_to: hazard.valid_to,
        },
      },
    };
  });
}

/**
 * Fetches official base operational boundaries (IMBL, Naval ranges, MPAs)
 * from GET /api/v1/layers/base and maps them to canonical MapLayers.
 */
export async function fetchAndFormatBaseLayers(): Promise<MapLayer[]> {
  try {
    const fc = await getBaseLayers();
    if (!fc || !Array.isArray(fc.features)) return [];

    return fc.features.map((f: any, idx: number) => {
      const props = f.properties || {};
      const level = props.restriction_level || 'INFORMATIONAL';
      const color =
        level === 'NO_GO'
          ? '#ef4444'
          : level === 'NO_GO_TRAWLING'
          ? '#f97316'
          : level === 'ADVISORY_ALERT'
          ? '#eab308'
          : '#38bdf8';

      return {
        layer_id: `base_${props.polygon_id || idx}`,
        name: props.name || `Operational Zone ${idx + 1}`,
        layer_type: 'geojson' as const,
        visible: true,
        style: {
          color,
          opacity: 0.22,
          line_width: 2,
          layer_category: 'base_geofence',
        },
        geojson: f,
      };
    });
  } catch {
    return [];
  }
}

