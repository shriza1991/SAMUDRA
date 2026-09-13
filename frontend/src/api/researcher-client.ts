/**
 * Researcher Dashboard API Client & Mock Data
 *
 * Fetches from /api/v1/demo/* endpoints with in-memory mock fallback.
 */

const API_BASE = '/api/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HarborData {
  public_id: string;
  name: string;
  latitude: number;
  longitude: number;
  state: string;
  metadata_json?: Record<string, any>;
}

export interface MarineObservation {
  public_id: string;
  harbor_id: string;
  observation_time: string;
  wave_height_m: number;
  sst_celsius: number;
  wind_speed_kn: number;
  wind_direction_deg: number;
  current_speed_kn: number;
  swell_period_s: number;
  visibility_nm: number;
  source: string;
  data_mode: string;
  quality_flags: string[];
}

export interface EOGridCell {
  cell_id: string;
  center_lat: number;
  center_lon: number;
  chlorophyll_a_mg_m3: number;
  sst_celsius: number;
  cloud_cover_pct: number;
  satellite: string;
  pass_time: string;
  resolution_m: number;
  source: string;
}

export interface PFZCandidate {
  public_id: string;
  latitude: number;
  longitude: number;
  sst_celsius: number;
  chlorophyll_a_mg_m3: number;
  distance_km: number;
  bearing_deg: number;
  rank: number;
  status: string;
  valid_from: string;
  valid_to: string;
  source: string;
}

export interface HazardBulletin {
  public_id: string;
  headline: string;
  severity: string;
  status: string;
  issued_at: string;
  valid_until: string;
  source: string;
  affected_area?: string;
  description?: string;
}

export interface ScenarioMeta {
  id: string;
  name: string;
  description: string;
  query: string;
  intent: string;
  expected_status: string;
  harbor?: string;
}

export interface ScenarioRunResult {
  scenario_id: string;
  status: string;
  recommendation_status: string;
  answer: string;
  evidence_count: number;
  trace_steps: number;
  execution_time_ms: number;
  warnings: string[];
  decisive_factors: string[];
  confidence_level: string;
}

export interface HealthStatus {
  status: string;
  app_name: string;
  app_env: string;
  data_mode: string;
  database: string;
  timestamp: string;
}

export interface DataSourceInfo {
  name: string;
  provider: string;
  data_mode: string;
  status: 'online' | 'degraded' | 'offline' | 'planned';
  last_updated: string;
  freshness_hours: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Generic fetcher with mock fallback
// ---------------------------------------------------------------------------

async function fetchOrMock<T>(url: string, mockData: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return res.json();
    return mockData;
  } catch {
    return mockData;
  }
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_HARBORS: HarborData[] = [
  { public_id: 'harbor-ratnagiri', name: 'Ratnagiri', latitude: 16.99, longitude: 73.28, state: 'Maharashtra', metadata_json: { coastal_zone: 'Konkan', vhf_channel: 16 } },
  { public_id: 'harbor-malvan', name: 'Malvan', latitude: 16.06, longitude: 73.47, state: 'Maharashtra', metadata_json: { coastal_zone: 'Sindhudurg', vhf_channel: 16 } },
];

const MOCK_MARINE_OBS: MarineObservation[] = [
  { public_id: 'obs-rat-01', harbor_id: 'harbor-ratnagiri', observation_time: '2026-09-12T06:00:00Z', wave_height_m: 2.1, sst_celsius: 28.6, wind_speed_kn: 18, wind_direction_deg: 225, current_speed_kn: 1.2, swell_period_s: 8.5, visibility_nm: 12, source: 'INCOIS OSF', data_mode: 'HYBRID', quality_flags: ['fresh', 'official_source'] },
  { public_id: 'obs-rat-02', harbor_id: 'harbor-ratnagiri', observation_time: '2026-09-12T12:00:00Z', wave_height_m: 2.4, sst_celsius: 29.1, wind_speed_kn: 22, wind_direction_deg: 240, current_speed_kn: 1.5, swell_period_s: 9.0, visibility_nm: 10, source: 'INCOIS OSF', data_mode: 'HYBRID', quality_flags: ['fresh'] },
  { public_id: 'obs-rat-03', harbor_id: 'harbor-ratnagiri', observation_time: '2026-09-12T18:00:00Z', wave_height_m: 1.8, sst_celsius: 28.3, wind_speed_kn: 14, wind_direction_deg: 210, current_speed_kn: 0.9, swell_period_s: 7.5, visibility_nm: 15, source: 'Open-Meteo', data_mode: 'LIVE', quality_flags: ['fresh', 'fallback'] },
  { public_id: 'obs-mal-01', harbor_id: 'harbor-malvan', observation_time: '2026-09-12T06:00:00Z', wave_height_m: 1.6, sst_celsius: 28.2, wind_speed_kn: 15, wind_direction_deg: 200, current_speed_kn: 0.8, swell_period_s: 7.0, visibility_nm: 18, source: 'INCOIS OSF', data_mode: 'HYBRID', quality_flags: ['fresh', 'official_source'] },
  { public_id: 'obs-mal-02', harbor_id: 'harbor-malvan', observation_time: '2026-09-12T12:00:00Z', wave_height_m: 1.9, sst_celsius: 28.8, wind_speed_kn: 19, wind_direction_deg: 215, current_speed_kn: 1.1, swell_period_s: 8.0, visibility_nm: 14, source: 'INCOIS OSF', data_mode: 'HYBRID', quality_flags: ['fresh'] },
  { public_id: 'obs-mal-03', harbor_id: 'harbor-malvan', observation_time: '2026-09-12T18:00:00Z', wave_height_m: 1.4, sst_celsius: 27.9, wind_speed_kn: 11, wind_direction_deg: 190, current_speed_kn: 0.6, swell_period_s: 6.5, visibility_nm: 20, source: 'Open-Meteo', data_mode: 'LIVE', quality_flags: ['fresh', 'fallback'] },
];

const MOCK_EO_CELLS: EOGridCell[] = [
  { cell_id: 'eo-cell-01', center_lat: 16.85, center_lon: 73.10, chlorophyll_a_mg_m3: 1.2, sst_celsius: 28.4, cloud_cover_pct: 15, satellite: 'Oceansat-3 OCM', pass_time: '2026-09-12T04:30:00Z', resolution_m: 360, source: 'ISRO MOSDAC' },
  { cell_id: 'eo-cell-02', center_lat: 16.95, center_lon: 73.20, chlorophyll_a_mg_m3: 0.8, sst_celsius: 28.9, cloud_cover_pct: 22, satellite: 'Oceansat-3 OCM', pass_time: '2026-09-12T04:30:00Z', resolution_m: 360, source: 'ISRO MOSDAC' },
  { cell_id: 'eo-cell-03', center_lat: 17.05, center_lon: 73.00, chlorophyll_a_mg_m3: 2.1, sst_celsius: 27.8, cloud_cover_pct: 8, satellite: 'INSAT-3DR', pass_time: '2026-09-12T05:00:00Z', resolution_m: 4000, source: 'ISRO MOSDAC' },
  { cell_id: 'eo-cell-04', center_lat: 16.20, center_lon: 73.30, chlorophyll_a_mg_m3: 1.6, sst_celsius: 28.1, cloud_cover_pct: 12, satellite: 'Oceansat-3 OCM', pass_time: '2026-09-12T04:30:00Z', resolution_m: 360, source: 'ISRO MOSDAC' },
  { cell_id: 'eo-cell-05', center_lat: 16.10, center_lon: 73.40, chlorophyll_a_mg_m3: 0.5, sst_celsius: 29.2, cloud_cover_pct: 35, satellite: 'INSAT-3DR', pass_time: '2026-09-12T05:00:00Z', resolution_m: 4000, source: 'ISRO MOSDAC' },
];

const MOCK_PFZ: PFZCandidate[] = [
  { public_id: 'pfz-mh-01', latitude: 16.82, longitude: 72.95, sst_celsius: 28.4, chlorophyll_a_mg_m3: 1.2, distance_km: 42.6, bearing_deg: 245, rank: 1, status: 'ACTIVE', valid_from: '2026-09-12T00:00:00Z', valid_to: '2026-09-12T23:59:59Z', source: 'INCOIS PFZ Advisory' },
  { public_id: 'pfz-mh-02', latitude: 16.45, longitude: 72.80, sst_celsius: 27.9, chlorophyll_a_mg_m3: 1.8, distance_km: 78.3, bearing_deg: 225, rank: 2, status: 'ACTIVE', valid_from: '2026-09-12T00:00:00Z', valid_to: '2026-09-12T23:59:59Z', source: 'INCOIS PFZ Advisory' },
  { public_id: 'pfz-mh-03', latitude: 17.15, longitude: 72.70, sst_celsius: 28.8, chlorophyll_a_mg_m3: 0.9, distance_km: 65.1, bearing_deg: 280, rank: 3, status: 'ACTIVE', valid_from: '2026-09-12T00:00:00Z', valid_to: '2026-09-12T23:59:59Z', source: 'INCOIS PFZ Advisory' },
];

const MOCK_HAZARDS: HazardBulletin[] = [
  { public_id: 'hazard-01', headline: 'High Wave Alert — Konkan Coast', severity: 'WARNING', status: 'ACTIVE', issued_at: '2026-09-12T03:00:00Z', valid_until: '2026-09-12T18:00:00Z', source: 'IMD Coastal Bulletin', affected_area: 'Ratnagiri–Goa corridor', description: 'Significant wave height 2.5-3.5m expected along Konkan coast.' },
  { public_id: 'hazard-02', headline: 'Squally Winds — Arabian Sea', severity: 'WATCH', status: 'ACTIVE', issued_at: '2026-09-12T06:00:00Z', valid_until: '2026-09-13T06:00:00Z', source: 'IMD Marine Weather', affected_area: 'Central Arabian Sea', description: 'Wind gusts 40-50 kmph likely over central Arabian Sea.' },
  { public_id: 'hazard-05', headline: 'Strong Current Advisory', severity: 'ADVISORY', status: 'ACTIVE', issued_at: '2026-09-12T04:00:00Z', valid_until: '2026-09-12T16:00:00Z', source: 'INCOIS OSF', affected_area: 'Ratnagiri offshore', description: 'Surface current 1.5+ knots W-SW direction.' },
];

const MOCK_SCENARIOS: ScenarioMeta[] = [
  { id: 'S1', name: 'Ratnagiri Safety Check', description: 'GO/NO-GO departure safety evaluation from Ratnagiri harbor', query: 'Is it safe to leave Ratnagiri tomorrow morning?', intent: 'GO_NO_GO_SAFETY', expected_status: 'CAUTION', harbor: 'Ratnagiri' },
  { id: 'S2', name: 'PFZ Discovery', description: 'Nearest Potential Fishing Zone discovery from Ratnagiri', query: 'Where is the nearest PFZ from Ratnagiri today?', intent: 'NEAREST_PFZ', expected_status: 'GO', harbor: 'Ratnagiri' },
  { id: 'S3', name: 'Cyclone Hazard Alert', description: 'Active cyclone and hazard advisory check', query: 'Any cyclone or storm risk near Ratnagiri?', intent: 'HAZARD_ALERT', expected_status: 'NO_GO', harbor: 'Ratnagiri' },
  { id: 'S4', name: 'Route Comparison', description: 'Safer route comparison between alternatives', query: 'Which route from Ratnagiri to PFZ is safest?', intent: 'ROUTE_COMPARISON', expected_status: 'CAUTION', harbor: 'Ratnagiri' },
  { id: 'S5', name: 'Malvan Safety Check', description: 'Safety evaluation for Malvan departure', query: 'Is it safe to depart Malvan at dawn?', intent: 'GO_NO_GO_SAFETY', expected_status: 'GO', harbor: 'Malvan' },
  { id: 'S6', name: 'Boundary Alert', description: 'Maritime boundary and restricted zone check', query: 'Am I near any restricted waters sailing south from Malvan?', intent: 'BOUNDARY_ALERT', expected_status: 'CAUTION', harbor: 'Malvan' },
  { id: 'S7', name: 'Hindi Safety Query', description: 'Multilingual safety check in Hindi', query: 'क्या कल सुबह रत्नागिरि से निकलना सुरक्षित है?', intent: 'GO_NO_GO_SAFETY', expected_status: 'CAUTION', harbor: 'Ratnagiri' },
  { id: 'S8', name: 'Marathi PFZ Query', description: 'Multilingual PFZ discovery in Marathi', query: 'रत्नागिरीजवळ आज मासेमारीचे क्षेत्र कुठे आहे?', intent: 'NEAREST_PFZ', expected_status: 'GO', harbor: 'Ratnagiri' },
];

const MOCK_HEALTH: HealthStatus = {
  status: 'healthy',
  app_name: 'SAMUDRA',
  app_env: 'development',
  data_mode: 'SNAPSHOT',
  database: 'connected',
  timestamp: new Date().toISOString(),
};

export const DATA_SOURCES: DataSourceInfo[] = [
  { name: 'INCOIS Ocean State Forecast', provider: 'INCOIS', data_mode: 'HYBRID', status: 'online', last_updated: '2026-09-12T04:00:00Z', freshness_hours: 2, description: 'Wave height, swell, SST, currents from INCOIS OSF bulletins.' },
  { name: 'INCOIS PFZ Advisory', provider: 'INCOIS', data_mode: 'CACHED_REAL', status: 'online', last_updated: '2026-09-12T00:00:00Z', freshness_hours: 6, description: 'Potential Fishing Zone advisory coordinates and fronts.' },
  { name: 'INCOIS SVAS', provider: 'INCOIS', data_mode: 'CACHED_REAL', status: 'degraded', last_updated: '2026-09-11T18:00:00Z', freshness_hours: 12, description: 'Small Vessel Advisory Services — capsizing risk indices.' },
  { name: 'IMD Marine Weather', provider: 'IMD', data_mode: 'HYBRID', status: 'online', last_updated: '2026-09-12T05:30:00Z', freshness_hours: 1, description: 'Coastal sea bulletins, port warnings, wind and visibility forecasts.' },
  { name: 'IMD Cyclone & Hazard', provider: 'IMD', data_mode: 'HYBRID', status: 'online', last_updated: '2026-09-12T06:00:00Z', freshness_hours: 0.5, description: 'Cyclone bulletins, squall alerts, depression tracks, red alert triggers.' },
  { name: 'Open-Meteo Marine', provider: 'Open-Meteo', data_mode: 'LIVE', status: 'online', last_updated: '2026-09-12T06:00:00Z', freshness_hours: 0.1, description: 'High-resolution wave, swell, and wind fallback (unauthoritative).' },
  { name: 'ISRO MOSDAC EO', provider: 'ISRO', data_mode: 'PLANNED', status: 'planned', last_updated: '', freshness_hours: -1, description: 'Satellite SST, Chlorophyll-a rasters from Oceansat and INSAT.' },
  { name: 'Pilot GIS Restrictions', provider: 'SAMUDRA', data_mode: 'CACHED_REAL', status: 'online', last_updated: '2026-09-01T00:00:00Z', freshness_hours: 264, description: 'Static geofences: MPAs, naval firing ranges, IMBL buffers.' },
];

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchHarbors(): Promise<HarborData[]> {
  return fetchOrMock('/demo/harbors', MOCK_HARBORS);
}

export async function fetchMarineObservations(harborId?: string): Promise<MarineObservation[]> {
  const url = harborId ? `/demo/marine-observations?harbor_id=${harborId}` : '/demo/marine-observations';
  return fetchOrMock(url, harborId ? MOCK_MARINE_OBS.filter(o => o.harbor_id === harborId) : MOCK_MARINE_OBS);
}

export async function fetchEOGridCells(): Promise<EOGridCell[]> {
  return fetchOrMock('/demo/eo-grid-cells', MOCK_EO_CELLS);
}

export async function fetchPFZCandidates(): Promise<PFZCandidate[]> {
  return fetchOrMock('/demo/pfz-candidates?valid_only=true', MOCK_PFZ);
}

export async function fetchHazards(): Promise<HazardBulletin[]> {
  return fetchOrMock('/demo/hazards', MOCK_HAZARDS);
}

export async function fetchScenarios(): Promise<ScenarioMeta[]> {
  try {
    const res = await fetch(`${API_BASE}/scenarios`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return data.scenarios || data;
    }
    return MOCK_SCENARIOS;
  } catch {
    return MOCK_SCENARIOS;
  }
}

export async function runScenario(scenarioId: string): Promise<ScenarioRunResult> {
  try {
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/run`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return res.json();
  } catch { /* fall through to mock */ }

  // Mock result
  const scenario = MOCK_SCENARIOS.find(s => s.id === scenarioId);
  await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
  return {
    scenario_id: scenarioId,
    status: 'completed',
    recommendation_status: scenario?.expected_status ?? 'UNKNOWN',
    answer: `[MOCK] ${scenario?.description ?? 'Scenario evaluation complete.'}`,
    evidence_count: 2 + Math.floor(Math.random() * 3),
    trace_steps: 5 + Math.floor(Math.random() * 3),
    execution_time_ms: 800 + Math.floor(Math.random() * 1200),
    warnings: ['[SNAPSHOT] Mock scenario execution — not connected to live pipeline.'],
    decisive_factors: ['Wave height within operational limits', 'IMD bulletin reviewed'],
    confidence_level: 'MEDIUM',
  };
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  return fetchOrMock('/health', MOCK_HEALTH);
}
