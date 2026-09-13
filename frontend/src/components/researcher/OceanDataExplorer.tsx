import { useState, useEffect } from 'react';
import {
  Waves, Thermometer, Wind, Navigation, Satellite, Fish,
  AlertTriangle, RefreshCw, ChevronDown,
} from 'lucide-react';
import {
  fetchHarbors, fetchMarineObservations, fetchEOGridCells,
  fetchPFZCandidates, fetchHazards,
  type HarborData, type MarineObservation, type EOGridCell,
  type PFZCandidate, type HazardBulletin,
} from '../../api/researcher-client';

export default function OceanDataExplorer() {
  const [harbors, setHarbors] = useState<HarborData[]>([]);
  const [selectedHarbor, setSelectedHarbor] = useState<string>('');
  const [observations, setObservations] = useState<MarineObservation[]>([]);
  const [eoCells, setEoCells] = useState<EOGridCell[]>([]);
  const [pfzCandidates, setPfzCandidates] = useState<PFZCandidate[]>([]);
  const [hazards, setHazards] = useState<HazardBulletin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedHarbor) {
      loadObservations(selectedHarbor);
    }
  }, [selectedHarbor]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [h, eo, pfz, hz] = await Promise.all([
        fetchHarbors(), fetchEOGridCells(), fetchPFZCandidates(), fetchHazards(),
      ]);
      setHarbors(h);
      setEoCells(eo);
      setPfzCandidates(pfz);
      setHazards(hz);
      if (h.length > 0) {
        setSelectedHarbor(h[0].public_id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadObservations(harborId: string) {
    const obs = await fetchMarineObservations(harborId);
    setObservations(obs);
  }

  const latest = observations.length > 0 ? observations[observations.length - 1] : null;
  const harborName = harbors.find(h => h.public_id === selectedHarbor)?.name ?? '—';

  function formatTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return iso; }
  }
  function formatDate(iso: string) {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch { return iso; }
  }

  if (loading) {
    return (
      <div className="researcher-loading">
        <RefreshCw size={20} className="researcher-spinner" />
        <span>Loading ocean data…</span>
      </div>
    );
  }

  return (
    <div className="researcher-ocean-explorer">
      {/* Harbor Selector */}
      <div className="researcher-toolbar">
        <div className="researcher-harbor-select">
          <Navigation size={14} />
          <select
            value={selectedHarbor}
            onChange={e => setSelectedHarbor(e.target.value)}
            aria-label="Select harbor"
          >
            {harbors.map(h => (
              <option key={h.public_id} value={h.public_id}>{h.name} ({h.state})</option>
            ))}
          </select>
          <ChevronDown size={12} className="researcher-select-chevron" />
        </div>
        <button className="researcher-refresh-btn" onClick={loadInitialData} aria-label="Refresh data">
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Marine Condition Cards */}
      <section className="researcher-section">
        <h3 className="researcher-section-title">Marine Conditions — {harborName}</h3>
        <div className="researcher-metric-grid">
          <div className="researcher-metric-card">
            <div className="researcher-metric-icon" style={{ color: '#3b82f6' }}><Waves size={20} /></div>
            <div className="researcher-metric-body">
              <span className="researcher-metric-label">Wave Height</span>
              <span className="researcher-metric-value">{latest?.wave_height_m?.toFixed(1) ?? '—'} <small>m</small></span>
              <span className="researcher-metric-sub">Swell {latest?.swell_period_s?.toFixed(1) ?? '—'}s</span>
            </div>
          </div>
          <div className="researcher-metric-card">
            <div className="researcher-metric-icon" style={{ color: '#ef4444' }}><Thermometer size={20} /></div>
            <div className="researcher-metric-body">
              <span className="researcher-metric-label">Sea Surface Temp</span>
              <span className="researcher-metric-value">{latest?.sst_celsius?.toFixed(1) ?? '—'} <small>°C</small></span>
              <span className="researcher-metric-sub">Source: {latest?.source ?? '—'}</span>
            </div>
          </div>
          <div className="researcher-metric-card">
            <div className="researcher-metric-icon" style={{ color: '#0ea5e9' }}><Wind size={20} /></div>
            <div className="researcher-metric-body">
              <span className="researcher-metric-label">Wind Speed</span>
              <span className="researcher-metric-value">{latest?.wind_speed_kn ?? '—'} <small>kn</small></span>
              <span className="researcher-metric-sub">{latest?.wind_direction_deg ?? '—'}° direction</span>
            </div>
          </div>
          <div className="researcher-metric-card">
            <div className="researcher-metric-icon" style={{ color: '#8b5cf6' }}><Navigation size={20} /></div>
            <div className="researcher-metric-body">
              <span className="researcher-metric-label">Current Speed</span>
              <span className="researcher-metric-value">{latest?.current_speed_kn?.toFixed(1) ?? '—'} <small>kn</small></span>
              <span className="researcher-metric-sub">Visibility {latest?.visibility_nm ?? '—'} nm</span>
            </div>
          </div>
        </div>
      </section>

      {/* Observation Timeline */}
      <section className="researcher-section">
        <h3 className="researcher-section-title">Observation Timeline</h3>
        <div className="researcher-table-wrap">
          <table className="researcher-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Wave (m)</th>
                <th>SST (°C)</th>
                <th>Wind (kn)</th>
                <th>Swell (s)</th>
                <th>Source</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {observations.map(obs => (
                <tr key={obs.public_id}>
                  <td className="researcher-cell-mono">{formatTime(obs.observation_time)}</td>
                  <td className={(obs.wave_height_m ?? 0) > 2.5 ? 'researcher-cell-danger' : (obs.wave_height_m ?? 0) > 1.8 ? 'researcher-cell-warning' : ''}>
                    {obs.wave_height_m != null ? obs.wave_height_m.toFixed(1) : '—'}
                  </td>
                  <td>{obs.sst_celsius != null ? obs.sst_celsius.toFixed(1) : '—'}</td>
                  <td className={(obs.wind_speed_kn ?? 0) > 25 ? 'researcher-cell-danger' : (obs.wind_speed_kn ?? 0) > 18 ? 'researcher-cell-warning' : ''}>
                    {obs.wind_speed_kn ?? '—'}
                  </td>
                  <td>{obs.swell_period_s != null ? obs.swell_period_s.toFixed(1) : '—'}</td>
                  <td><span className="researcher-source-badge">{obs.source}</span></td>
                  <td>
                    {(obs.quality_flags || []).map(f => (
                      <span key={f} className={`researcher-quality-flag ${f === 'official_source' ? 'official' : f === 'fallback' ? 'fallback' : ''}`}>{f}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two-Column: EO Grid + PFZ */}
      <div className="researcher-two-col">
        {/* EO Satellite Data */}
        <section className="researcher-section">
          <h3 className="researcher-section-title">
            <Satellite size={14} />
            Earth Observation Grid
          </h3>
          <div className="researcher-table-wrap">
            <table className="researcher-table researcher-table-compact">
              <thead>
                <tr>
                  <th>Cell</th>
                  <th>Chl-a (mg/m³)</th>
                  <th>SST (°C)</th>
                  <th>Cloud %</th>
                  <th>Satellite</th>
                  <th>Res.</th>
                </tr>
              </thead>
              <tbody>
                {eoCells.map(cell => (
                  <tr key={cell.cell_id}>
                    <td className="researcher-cell-mono">{cell.cell_id}</td>
                    <td style={{ color: (cell.chlorophyll_a_mg_m3 ?? 0) > 1.5 ? '#10b981' : undefined, fontWeight: (cell.chlorophyll_a_mg_m3 ?? 0) > 1.5 ? 600 : undefined }}>
                      {cell.chlorophyll_a_mg_m3 != null ? cell.chlorophyll_a_mg_m3.toFixed(2) : '—'}
                    </td>
                    <td>{cell.sst_celsius != null ? cell.sst_celsius.toFixed(1) : '—'}</td>
                    <td className={(cell.cloud_cover_pct ?? 0) > 30 ? 'researcher-cell-warning' : ''}>
                      {cell.cloud_cover_pct != null ? `${cell.cloud_cover_pct}%` : '—'}
                    </td>
                    <td><span className="researcher-source-badge">{cell.satellite}</span></td>
                    <td>{cell.resolution_m}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* PFZ Candidates */}
        <section className="researcher-section">
          <h3 className="researcher-section-title">
            <Fish size={14} />
            PFZ Advisory Candidates
          </h3>
          <div className="researcher-pfz-cards">
            {pfzCandidates.map(pfz => (
              <div key={pfz.public_id} className="researcher-pfz-card">
                <div className="researcher-pfz-rank">#{pfz.rank}</div>
                <div className="researcher-pfz-body">
                  <div className="researcher-pfz-id">{pfz.public_id}</div>
                  <div className="researcher-pfz-stats">
                    <span>{pfz.distance_km != null ? pfz.distance_km.toFixed(1) : '—'} km · {pfz.bearing_deg ?? 0}°</span>
                    <span>SST {pfz.sst_celsius != null ? `${pfz.sst_celsius}°C` : '—'} · Chl-a {pfz.chlorophyll_a_mg_m3 != null ? `${pfz.chlorophyll_a_mg_m3} mg/m³` : '—'}</span>
                  </div>
                  <div className="researcher-pfz-validity">
                    Valid: {formatDate(pfz.valid_from)} — {formatDate(pfz.valid_to)}
                  </div>
                </div>
                <span className={`researcher-status-badge ${pfz.status === 'ACTIVE' ? 'go' : ''}`}>{pfz.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Hazard Bulletins */}
      <section className="researcher-section">
        <h3 className="researcher-section-title">
          <AlertTriangle size={14} />
          Active Hazard Bulletins
        </h3>
        <div className="researcher-hazard-list">
          {hazards.map(hz => (
            <div key={hz.public_id} className={`researcher-hazard-card severity-${hz.severity.toLowerCase()}`}>
              <div className="researcher-hazard-header">
                <span className={`researcher-severity-badge ${hz.severity.toLowerCase()}`}>{hz.severity}</span>
                <span className="researcher-hazard-title">{hz.headline}</span>
              </div>
              {hz.description && <p className="researcher-hazard-desc">{hz.description}</p>}
              <div className="researcher-hazard-meta">
                <span>Source: {hz.source}</span>
                <span>Area: {hz.affected_area ?? '—'}</span>
                <span>Valid until: {formatTime(hz.valid_until)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
