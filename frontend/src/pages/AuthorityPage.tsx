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
import { createSectorLayers, getSectorConfig, fetchAndFormatBaseLayers } from '../utils/geo';
import { translateText } from '../i18n/translations';

export interface AuthorityPageProps {
  chat: ReturnType<typeof useChat>;
  theme: 'light' | 'dark';
  mobileView: 'chat' | 'map';
  onOpenEvidence: () => void;
  onBack: () => void;
}

export type AuthorityTab = 'terminal' | 'fleet' | 'benchmarks' | 'audit';

const SECTORS = [
  'Ratnagiri Sector (MH-03)',
  'Malvan Marine Zone (MH-04)',
  'Goa Naval Corridor (GA-01)',
  'Mumbai Offshore (MH-01)',
  'Veraval Coastal Zone (GJ-02)',
];

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
  const [selectedSector, setSelectedSector] = useState(SECTORS[0]);
  const [authorityTab, setAuthorityTab] = useState<AuthorityTab>('terminal');
  const [replayLayer, setReplayLayer] = useState<MapLayer | null>(null);
  const [baseLayers, setBaseLayers] = useState<MapLayer[]>([]);

  useEffect(() => {
    fetchAndFormatBaseLayers().then(setBaseLayers);
  }, []);

  const sectorConfig = useMemo(() => getSectorConfig(selectedSector), [selectedSector]);

  // Combine official base boundaries + sector polygon + replay trajectory + active query layers
  const authorityLayers = useMemo(() => {
    const sectorLayers = createSectorLayers(selectedSector);
    const responseLayers = chat.activeResponse?.map_layers ?? [];
    const activeReplay = replayLayer ? [replayLayer] : [];
    return [...baseLayers, ...sectorLayers, ...activeReplay, ...responseLayers];
  }, [baseLayers, selectedSector, replayLayer, chat.activeResponse?.map_layers]);

  const status = chat.activeResponse?.recommendation.status ?? 'READY';
  const evidenceList = chat.activeResponse?.evidence ?? [];
  const traceList = chat.activeResponse?.trace ?? [];
  const warningsList = chat.activeResponse?.warnings ?? [];
  const hazardLayers = authorityLayers.filter((l) =>
    `${l.layer_id} ${l.name}`.toLowerCase().includes('hazard') ||
    `${l.layer_id} ${l.name}`.toLowerCase().includes('warning') ||
    `${l.layer_id} ${l.name}`.toLowerCase().includes('squall') ||
    `${l.layer_id} ${l.name}`.toLowerCase().includes('sanctuary')
  );

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
              onChange={(e) => setSelectedSector(e.target.value)}
              className="authority-sector-select"
              aria-label={translateText('Sector:', chat.language)}
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
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
          <div className="authority-kpi-chip">
            <span className="chip-label">{translateText('Verdict:', chat.language)}</span>
            <span className={`status-pill status-${status.toLowerCase().replace('_', '-')}`}>
              {status.replace('_', '-')}
            </span>
          </div>

          <div className="authority-kpi-chip">
            <AlertTriangle size={13} className={hazardLayers.length > 0 ? 'status-no-go' : ''} />
            <span><strong>{hazardLayers.length}</strong> {translateText('Hazards', chat.language)}</span>
          </div>

          {evidenceList.length > 0 && (
            <button
              type="button"
              className={`authority-kpi-chip authority-evidence-btn ${authorityTab === 'audit' ? 'active' : ''}`}
              onClick={() => setAuthorityTab(authorityTab === 'audit' ? 'terminal' : 'audit')}
              title={translateText('Inspect verified evidence & execution trace', chat.language)}
            >
              <FileCheck2 size={13} className="status-accent" />
              <span><strong>{evidenceList.length}</strong> {translateText('Evidence', chat.language)}</span>
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
                activeResponse={chat.activeResponse}
                isLoading={chat.isLoading}
                onSend={chat.send}
                onBack={onBack}
                onReset={chat.clearChat}
                onEvidenceClick={onOpenEvidence}
              />
            </aside>

            {/* Right: Reused MapView with live coastal polygons */}
            <div className="authority-map-pane">
              <MapView
                layers={authorityLayers}
                theme={theme}
                center={sectorConfig.center}
                zoom={sectorConfig.zoom}
                language={chat.language}
              />
            </div>
          </div>
        )}

        {authorityTab === 'fleet' && (
          <div className="authority-workspace-grid authority-fleet-grid">
            <aside className="authority-fleet-pane" aria-label="Fleet Surveillance Pane">
              <FleetTrackingDeck onReplayUpdate={setReplayLayer} language={chat.language} />
            </aside>
            <div className="authority-map-pane">
              <MapView
                layers={authorityLayers}
                theme={theme}
                center={sectorConfig.center}
                zoom={sectorConfig.zoom}
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
