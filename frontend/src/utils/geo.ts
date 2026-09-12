import type { MapLayer } from '../types/contracts';

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

export interface SectorDefinition {
  center: [number, number];
  zoom: number;
  label: string;
  stationName: string;
  polygon: [number, number][];
  bufferPolygon?: [number, number][];
}

export const SECTOR_SURVEILLANCE_CONFIGS: Record<string, SectorDefinition> = {
  'Ratnagiri Sector (MH-03)': {
    center: [73.28, 16.99],
    zoom: 8.8,
    label: 'Ratnagiri Coastal Sector (MH-03)',
    stationName: 'Ratnagiri Coast Guard & Fisheries Post',
    polygon: [
      [72.6, 16.5],
      [73.5, 16.5],
      [73.5, 17.5],
      [72.6, 17.5],
      [72.6, 16.5],
    ],
  },
  'Malvan Marine Zone (MH-04)': {
    center: [73.47, 16.06],
    zoom: 9.5,
    label: 'Malvan Marine Sanctuary & Buffer (MH-04)',
    stationName: 'Malvan Marine Surveillance Unit',
    polygon: [
      [73.35, 15.95],
      [73.58, 15.95],
      [73.58, 16.18],
      [73.35, 16.18],
      [73.35, 15.95],
    ],
  },
  'Goa Naval Corridor (GA-01)': {
    center: [73.83, 15.49],
    zoom: 9.0,
    label: 'Goa Naval Range & Exercise Corridor (GA-01)',
    stationName: 'Goa Port & Naval Traffic Center',
    polygon: [
      [73.4, 15.15],
      [74.05, 15.15],
      [74.05, 15.8],
      [73.4, 15.8],
      [73.4, 15.15],
    ],
  },
  'Mumbai Offshore (MH-01)': {
    center: [72.87, 18.92],
    zoom: 8.8,
    label: 'Mumbai Offshore & Harbor Security Zone (MH-01)',
    stationName: 'Mumbai Maritime Rescue Coordination Centre',
    polygon: [
      [72.2, 18.5],
      [73.15, 18.5],
      [73.15, 19.35],
      [72.2, 19.35],
      [72.2, 18.5],
    ],
  },
  'Veraval Coastal Zone (GJ-02)': {
    center: [70.37, 20.90],
    zoom: 8.5,
    label: 'Veraval Fisheries & International Buffer (GJ-02)',
    stationName: 'Veraval Coastal Police & Fisheries Command',
    polygon: [
      [69.8, 20.4],
      [70.9, 20.4],
      [70.9, 21.3],
      [69.8, 21.3],
      [69.8, 20.4],
    ],
  },
};

export function getSectorConfig(sectorName: string): SectorDefinition {
  return SECTOR_SURVEILLANCE_CONFIGS[sectorName] || SECTOR_SURVEILLANCE_CONFIGS['Ratnagiri Sector (MH-03)'];
}

/**
 * Creates GeoJSON MapLayers for authority sector surveillance.
 */
export function createSectorLayers(sectorName: string): MapLayer[] {
  const config = getSectorConfig(sectorName);
  const sectorId = sectorName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const sectorPolygonLayer: MapLayer = {
    layer_id: `sector_polygon_${sectorId}`,
    name: config.label,
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
            coordinates: [config.polygon],
          },
          properties: {
            sector: config.label,
            type: 'Active Maritime Surveillance Sector',
            authority: 'Coastal Security & Fisheries Enforcement',
          },
        },
      ],
    },
  };

  const sectorStationLayer: MapLayer = {
    layer_id: `sector_station_${sectorId}`,
    name: config.stationName,
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
        coordinates: config.center,
      },
      properties: {
        station: config.stationName,
        sector: config.label,
        type: 'Maritime Command & Radar Station',
        status: 'ACTIVE_SURVEILLANCE',
      },
    },
  };

  return [sectorPolygonLayer, sectorStationLayer];
}
