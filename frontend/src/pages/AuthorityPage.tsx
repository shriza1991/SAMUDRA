import { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  FileCheck2,
  FlaskConical,
  RadioTower,
  Ship,
} from 'lucide-react';
import ChatPanel from '../components/chat/ChatPanel';
import MapView from '../components/map/MapView';
import EvidenceCard from '../components/evidence/EvidenceCard';
import AgentTimeline from '../components/trace/AgentTimeline';
import ScenarioBenchmarkDeck from '../components/authority/ScenarioBenchmarkDeck';
import FleetTrackingDeck from '../components/authority/FleetTrackingDeck';
import type { useChat } from '../hooks/useChat';
import type { MapLayer } from '../types/contracts';
import {
  getDemoSectors,
  getDemoSectorHazards,
  getDemoSectorHazardAssociations,
  getDemoSectorSituation,
  type DemoSector,
  type SectorHazard,
  type VesselHazardAssociation,
  type VesselHazardOperationalAlert,
  type SectorSituation,
} from '../api/client';
import {
  createSectorLayers,
  createAuthorityHazardLayers,
  createHazardAssociationLayers,
  FALLBACK_DEMO_SECTORS,
  fetchAndFormatBaseLayers,
} from '../utils/geo';
import { translateText } from '../i18n/translations';

export interface AuthorityPageProps {
  chat: ReturnType<typeof useChat>;
  theme: 'light' | 'dark';
  mobileView: 'chat' | 'map';
  onOpenEvidence: () => void;
  onBack: () => void;
}

export type AuthorityTab = 'terminal' | 'fleet' | 'benchmarks' | 'audit';

/**
 * Authority Command Deck Page
 *
 * Tailored for port authorities, fisheries departments, disaster management teams,
 * and maritime enforcement officers.
 * Reuses ChatPanel, MapView, EvidenceCard, AgentTimeline, FleetTrackingDeck, and ScenarioBenchmarkDeck.
 */
export default function AuthorityPage({
  chat,
  theme,
  mobileView,
  onOpenEvidence,
  onBack,
}: AuthorityPageProps) {
  const [sectors, setSectors] = useState<DemoSector[]>(FALLBACK_DEMO_SECTORS);
  const [selectedSector, setSelectedSector] = useState<string>(FALLBACK_DEMO_SECTORS[0].public_id);
  const [authorityTab, setAuthorityTab] = useState<AuthorityTab>('terminal');
  const [replayLayer, setReplayLayer] = useState<MapLayer | null>(null);
  const [baseLayers, setBaseLayers] = useState<MapLayer[]>([]);

  const [sectorSituation, setSectorSituation] = useState<SectorSituation | null>(null);
  const [situationLoading, setSituationLoading] = useState<boolean>(false);
  const [situationError, setSituationError] = useState<string | null>(null);
  const [sectorHazards, setSectorHazards] = useState<SectorHazard[]>([]);
  const [hazardError, setHazardError] = useState<string | null>(null);
  const [hazardAssociations, setHazardAssociations] = useState<VesselHazardAssociation[]>([]);
  const [selectedOperationalAlert, setSelectedOperationalAlert] = useState<VesselHazardOperationalAlert | null>(null);

  useEffect(() => {
    fetchAndFormatBaseLayers().then(setBaseLayers);
    getDemoSectors()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSectors(data);
        }
      })
      .catch(() => {
        // Backend offline: FALLBACK_DEMO_SECTORS retained for dropdown continuity only
      });
  }, []);

  const activeSector = useMemo(() => {
    return sectors.find((s) => s.public_id === selectedSector) || sectors[0];
  }, [sectors, selectedSector]);

  // Chat history is retained across sector changes, but current-sector UI must
  // never present an earlier sector's response as the active response.
  const authorityActiveResponse = useMemo(() => {
    for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
      const message = chat.messages[index];
      if (message.role === 'assistant' && message.sectorId === activeSector.public_id && message.response) {
        return message.response;
      }
    }
    return null;
  }, [activeSector.public_id, chat.messages]);

  useEffect(() => {
    let isCurrent = true;
    setSituationLoading(true);
    setSituationError(null);
    // Crucial: immediately clear previous sector's situation to avoid stale state leakage
    setSectorSituation(null);

    const sectorKey = activeSector.public_id || activeSector.name;
    getDemoSectorSituation(sectorKey)
      .then((data) => {
        if (isCurrent) {
          setSectorSituation(data);
          setSituationLoading(false);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSituationError('Situation Unavailable');
          setSituationLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeSector]);

  useEffect(() => {
    let isCurrent = true;
    // Alert inspection is scoped to a single Authority sector and must never
    // survive a sector switch while its replacement data is loading.
    setSelectedOperationalAlert(null);
    setSectorHazards([]);
    setHazardError(null);

    getDemoSectorHazards(activeSector.public_id)
      .then((data) => {
        if (isCurrent) setSectorHazards(data.hazards);
      })
      .catch(() => {
        if (isCurrent) setHazardError('Hazard data unavailable');
      });

    return () => {
      isCurrent = false;
    };
  }, [activeSector.public_id]);

  useEffect(() => {
    let isCurrent = true;
    setHazardAssociations([]);
    getDemoSectorHazardAssociations(activeSector.public_id)
      .then((data) => { if (isCurrent) setHazardAssociations(data.associations); })
      .catch(() => { if (isCurrent) setHazardAssociations([]); });
    return () => { isCurrent = false; };
  }, [activeSector.public_id]);

  // Combine official base boundaries + sector polygon + replay trajectory + active query layers
  const authorityLayers = useMemo(() => {
    const sectorLayers = createSectorLayers(activeSector);
    const hazardLayers = createAuthorityHazardLayers(sectorHazards, selectedOperationalAlert?.hazard_id);
    const associationLayers = createHazardAssociationLayers(hazardAssociations, selectedOperationalAlert);
    const responseLayers = authorityActiveResponse?.map_layers ?? [];
    const activeReplay = replayLayer ? [replayLayer] : [];
    return [...baseLayers, ...sectorLayers, ...hazardLayers, ...associationLayers, ...activeReplay, ...responseLayers];
  }, [baseLayers, activeSector, sectorHazards, hazardAssociations, replayLayer, selectedOperationalAlert, authorityActiveResponse?.map_layers]);

  const evidenceList = useMemo(() => {
    if (authorityActiveResponse?.evidence && authorityActiveResponse.evidence.length > 0) {
      return authorityActiveResponse.evidence;
    }
    return sectorSituation?.evidence ?? [];
  }, [authorityActiveResponse?.evidence, sectorSituation?.evidence]);

  const traceList = authorityActiveResponse?.trace ?? [];

  const warningsList = useMemo(() => {
    if (authorityActiveResponse?.warnings && authorityActiveResponse.warnings.length > 0) {
      return authorityActiveResponse.warnings;
    }
    return sectorSituation?.warnings ?? [];
  }, [authorityActiveResponse?.warnings, sectorSituation?.warnings]);

  return (
    <div className={`authority-page view-${mobileView}`} role="region" aria-label="Authority Command Deck">
      {/* Single Unified Authority Command Bar */}
      <section className="authority-command-bar" aria-label="Operational Command Bar">
        <div className="authority-bar-left">
          <div className="authority-title-row">
            <Building2 size={15} className="authority-brand-icon" />
            <span className="authority-title">{translateText('Authority Command Deck', chat.language)}</span>
          </div>

          <label className="authority-sector-selector">
            <select
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setReplayLayer(null);
              }}
              className="authority-sector-select"
              aria-label={translateText('Sector:', chat.language)}
            >
              {sectors.map((s) => (
                <option key={s.public_id || s.name} value={s.public_id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Center: Sleek Segmented Switcher Pill */}
        <nav className="authority-nav-segmented" role="tablist" aria-label="Authority views">
          <button
            type="button"
            className={`authority-segment-btn ${authorityTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setAuthorityTab('terminal')}
            role="tab"
            aria-selected={authorityTab === 'terminal'}
          >
            <RadioTower size={13} />
            <span>{translateText('Audit Terminal', chat.language)}</span>
          </button>
          <button
            type="button"
            className={`authority-segment-btn ${authorityTab === 'fleet' ? 'active' : ''}`}
            onClick={() => setAuthorityTab('fleet')}
            role="tab"
            aria-selected={authorityTab === 'fleet'}
          >
            <Ship size={13} />
            <span>{translateText('Fleet Surveillance', chat.language)}</span>
          </button>
          <button
            type="button"
            className={`authority-segment-btn ${authorityTab === 'benchmarks' ? 'active' : ''}`}
            onClick={() => setAuthorityTab('benchmarks')}
            role="tab"
            aria-selected={authorityTab === 'benchmarks'}
          >
            <FlaskConical size={13} />
            <span>{translateText('Benchmark Runner', chat.language)}</span>
          </button>
        </nav>

        {/* Right: Live KPIs & Verified Sources */}
        <div className="authority-bar-right">
          {/* Situation Verdict */}
          <div className="authority-kpi-chip" data-testid="kpi-verdict">
            <span className="chip-label">{translateText('Verdict:', chat.language)}</span>
            {situationError ? (
              <span className="status-pill status-unknown">
                {translateText('UNAVAILABLE', chat.language)}
              </span>
            ) : situationLoading ? (
              <span className="status-pill status-ready">...</span>
            ) : (
              <span
                className={`status-pill status-${(sectorSituation?.situation_status || 'UNKNOWN').toLowerCase().replace('_', '-')}`}
              >
                {sectorSituation?.situation_status.replace('_', '-') || 'UNKNOWN'}
              </span>
            )}
          </div>

          {/* Dynamic Fleet Count */}
          <div className="authority-kpi-chip" data-testid="kpi-fleet">
            <Ship size={13} />
            <span>
              <strong>
                {situationError ? '—' : situationLoading ? '...' : (sectorSituation?.fleet_count ?? '—')}
              </strong>{' '}
              {translateText('Fleet', chat.language)}
            </span>
          </div>

          {/* Active Hazards Count */}
          <div className="authority-kpi-chip" data-testid="kpi-hazards">
            <AlertTriangle
              size={13}
              className={(sectorSituation?.active_hazard_count ?? 0) > 0 ? 'status-no-go' : ''}
            />
            <span>
              <strong>
                {situationError ? '—' : situationLoading ? '...' : (sectorSituation?.active_hazard_count ?? '—')}
              </strong>{' '}
              {translateText('Hazards', chat.language)}
            </span>
          </div>

          {/* Grounded Evidence Button */}
          {evidenceList.length > 0 && (
            <button
              type="button"
              className={`authority-kpi-chip authority-evidence-btn ${authorityTab === 'audit' ? 'active' : ''}`}
              onClick={() => setAuthorityTab(authorityTab === 'audit' ? 'terminal' : 'audit')}
              title={translateText('Inspect verified evidence & execution trace', chat.language)}
              data-testid="kpi-evidence"
            >
              <FileCheck2 size={13} className="status-accent" />
              <span>
                <strong>{evidenceList.length}</strong> {translateText('Evidence', chat.language)}
              </span>
            </button>
          )}
        </div>
      </section>

      {/* Workspace Body */}
      <div className="authority-body">
        {authorityTab === 'terminal' && (
          <div className="authority-workspace-grid">
            {/* Left: Reused ChatPanel in Official Dispatch Terminal Mode */}
            <aside className="authority-terminal-pane" aria-label="Terminal Pane">
              <ChatPanel
                language={chat.language}
                messages={chat.messages}
                activeResponse={authorityActiveResponse}
                isLoading={chat.isLoading}
                onSend={(text, languageOverride) => chat.send(text, languageOverride, {
                  sector_id: activeSector.public_id,
                })}
                onBack={onBack}
                onReset={chat.clearChat}
                onEvidenceClick={onOpenEvidence}
              />
            </aside>

            {/* Right: Reused MapView with live coastal polygons */}
            <div className="authority-map-pane">
              {hazardError && <p className="authority-empty-note" role="status">{hazardError}</p>}
              <MapView
                layers={authorityLayers}
                theme={theme}
                center={activeSector.center}
                zoom={activeSector.zoom}
                language={chat.language}
              />
            </div>
          </div>
        )}

        {authorityTab === 'fleet' && (
          <div className="authority-workspace-grid authority-fleet-grid">
            <aside className="authority-fleet-pane" aria-label="Fleet Surveillance Pane">
              <FleetTrackingDeck
                selectedSector={selectedSector}
                onReplayUpdate={setReplayLayer}
                onAlertSelectionChange={(alert) => {
                  // The alert endpoint is sector-scoped; still enforce the
                  // boundary at the UI hand-off so stale async UI state cannot
                  // highlight a different sector.
                  setSelectedOperationalAlert(alert?.sector_id === activeSector.public_id ? alert : null);
                }}
                language={chat.language}
              />
            </aside>
            <div className="authority-map-pane">
              <MapView
                layers={authorityLayers}
                theme={theme}
                center={activeSector.center}
                zoom={activeSector.zoom}
                language={chat.language}
              />
            </div>
          </div>
        )}

        {authorityTab === 'benchmarks' && (
          <div className="authority-benchmarks-container">
            <ScenarioBenchmarkDeck language={chat.language} />
          </div>
        )}

        {authorityTab === 'audit' && (
          /* Audit View: Direct In-Page Evidence & Agent Trace Logs */
          <div className="authority-audit-view">
            <div className="authority-audit-column">
              <div className="audit-section-header">
                <FileCheck2 size={16} />
                <h3>{translateText('Verified Official Evidence', chat.language)} ({evidenceList.length})</h3>
              </div>
              {evidenceList.length > 0 ? (
                <div className="authority-evidence-grid">
                  {evidenceList.map((ev, idx) => (
                    <EvidenceCard key={idx} evidence={ev} />
                  ))}
                </div>
              ) : (
                <p className="authority-empty-note">
                  {translateText('No active evidence items. Run an advisory query to inspect official telemetry.', chat.language)}
                </p>
              )}

              {warningsList.length > 0 && (
                <div className="authority-warnings-box">
                  <h4>{translateText('Active System Warnings & Fallbacks', chat.language)}</h4>
                  <ul>
                    {warningsList.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="authority-audit-column">
              <div className="audit-section-header">
                <Activity size={16} />
                <h3>{translateText('Autonomous Agent Execution Trail', chat.language)} ({traceList.length} {translateText('Steps', chat.language)})</h3>
              </div>
              {traceList.length > 0 ? (
                <div className="authority-timeline-card">
                  <AgentTimeline trace={traceList} />
                </div>
              ) : (
                <p className="authority-empty-note">
                  {translateText('No trace recorded. Queries processed by the cognitive graph will log execution steps here.', chat.language)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
