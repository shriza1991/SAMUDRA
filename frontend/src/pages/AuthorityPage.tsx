import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  FileCheck2,
  RadioTower,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import ChatPanel from '../components/chat/ChatPanel';
import MapView from '../components/map/MapView';
import EvidenceCard from '../components/evidence/EvidenceCard';
import AgentTimeline from '../components/trace/AgentTimeline';
import type { useChat } from '../hooks/useChat';

export interface AuthorityPageProps {
  chat: ReturnType<typeof useChat>;
  theme: 'light' | 'dark';
  mobileView: 'chat' | 'map';
  onOpenEvidence: () => void;
  onBack: () => void;
}

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
 * Reuses ChatPanel, MapView, EvidenceCard, and AgentTimeline.
 */
export default function AuthorityPage({
  chat,
  theme,
  mobileView,
  onOpenEvidence,
  onBack,
}: AuthorityPageProps) {
  const [selectedSector, setSelectedSector] = useState(SECTORS[0]);
  const [authorityTab, setAuthorityTab] = useState<'terminal' | 'audit'>('terminal');

  const status = chat.activeResponse?.recommendation.status ?? 'READY';
  const evidenceList = chat.activeResponse?.evidence ?? [];
  const traceList = chat.activeResponse?.trace ?? [];
  const warningsList = chat.activeResponse?.warnings ?? [];
  const hazardLayers = (chat.activeResponse?.map_layers ?? []).filter((l) =>
    `${l.layer_id} ${l.name}`.toLowerCase().includes('hazard') ||
    `${l.layer_id} ${l.name}`.toLowerCase().includes('warning') ||
    `${l.layer_id} ${l.name}`.toLowerCase().includes('squall')
  );

  return (
    <div className={`authority-page view-${mobileView}`} role="region" aria-label="Authority Command Deck">
      {/* Top Authority KPI Deck */}
      <section className="authority-kpi-bar" aria-label="Operational KPI Overview">
        <div className="authority-bar-left">
          <div className="authority-title-row">
            <Building2 size={18} className="authority-brand-icon" />
            <div>
              <h2>Maritime Authority Command Deck</h2>
              <span className="authority-subtitle">Official Fleet Advisory & Regulatory Surveillance</span>
            </div>
          </div>

          <label className="authority-sector-selector">
            <span>Surveillance Sector</span>
            <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        {/* 4 Standardized KPI Metric Cards */}
        <div className="authority-kpis">
          <div className="authority-kpi-card">
            <span className="kpi-label">Advisory Verdict</span>
            <div className="kpi-value-row">
              {status === 'NO_GO' ? (
                <ShieldAlert size={15} className="kpi-icon status-no-go" />
              ) : status === 'CAUTION' ? (
                <AlertTriangle size={15} className="kpi-icon status-caution" />
              ) : (
                <ShieldCheck size={15} className="kpi-icon status-go" />
              )}
              <strong className={`status-pill status-${status.toLowerCase().replace('_', '-')}`}>
                {status.replace('_', '-')}
              </strong>
            </div>
          </div>

          <div className="authority-kpi-card">
            <span className="kpi-label">Active Hazard Zones</span>
            <div className="kpi-value-row">
              <AlertTriangle size={15} className={hazardLayers.length > 0 ? 'kpi-icon status-no-go' : 'kpi-icon'} />
              <strong>{hazardLayers.length} Polygons</strong>
            </div>
          </div>

          <div className="authority-kpi-card">
            <span className="kpi-label">Official Sources</span>
            <div className="kpi-value-row">
              <FileCheck2 size={15} className="kpi-icon status-accent" />
              <strong>{evidenceList.length} Verified</strong>
            </div>
          </div>

          <div className="authority-kpi-card">
            <span className="kpi-label">Agent Execution</span>
            <div className="kpi-value-row">
              <Activity size={15} className="kpi-icon status-accent" />
              <strong>{traceList.length} Steps</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Authority View Switcher Tabs */}
      <nav className="authority-tab-nav" role="tablist" aria-label="Authority sub-views">
        <button
          type="button"
          className={`authority-tab-btn ${authorityTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setAuthorityTab('terminal')}
          role="tab"
          aria-selected={authorityTab === 'terminal'}
        >
          <RadioTower size={14} />
          <span>Regional Audit & Dispatch Terminal</span>
        </button>
        <button
          type="button"
          className={`authority-tab-btn ${authorityTab === 'audit' ? 'active' : ''}`}
          onClick={() => setAuthorityTab('audit')}
          role="tab"
          aria-selected={authorityTab === 'audit'}
        >
          <FileCheck2 size={14} />
          <span>Evidence & Autonomous Trace Log ({traceList.length})</span>
        </button>
      </nav>

      {/* Workspace Body */}
      <div className="authority-body">
        {authorityTab === 'terminal' ? (
          <div className="authority-workspace-grid">
            {/* Left: Reused ChatPanel in Official Dispatch Terminal Mode */}
            <aside className="authority-terminal-pane" aria-label="Terminal Pane">
              <div className="authority-terminal-header">
                <span>Surveillance Query Terminal</span>
                <button
                  type="button"
                  className="authority-reset-btn"
                  onClick={chat.clearChat}
                  title="Clear audit session"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

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
                layers={chat.activeResponse?.map_layers ?? []}
                theme={theme}
              />
            </div>
          </div>
        ) : (
          /* Audit View: Direct In-Page Evidence & Agent Trace Logs */
          <div className="authority-audit-view">
            <div className="authority-audit-column">
              <div className="audit-section-header">
                <FileCheck2 size={16} />
                <h3>Verified Official Evidence ({evidenceList.length})</h3>
              </div>
              {evidenceList.length > 0 ? (
                <div className="authority-evidence-grid">
                  {evidenceList.map((ev, idx) => (
                    <EvidenceCard key={idx} evidence={ev} />
                  ))}
                </div>
              ) : (
                <p className="authority-empty-note">
                  No active evidence items. Run an advisory query to inspect official telemetry.
                </p>
              )}

              {warningsList.length > 0 && (
                <div className="authority-warnings-box">
                  <h4>Active System Warnings & Fallbacks</h4>
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
                <h3>Autonomous Agent Execution Trail ({traceList.length} Steps)</h3>
              </div>
              {traceList.length > 0 ? (
                <div className="authority-timeline-card">
                  <AgentTimeline trace={traceList} />
                </div>
              ) : (
                <p className="authority-empty-note">
                  No trace recorded. Queries processed by the cognitive graph will log execution steps here.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
