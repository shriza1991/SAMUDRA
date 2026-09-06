import { useState } from 'react';
import type { EvidenceItem, AgentTraceItem } from '../../types/contracts';
import EvidenceCard from './EvidenceCard';
import AgentTimeline from '../trace/AgentTimeline';
import { X, FileText, Activity } from 'lucide-react';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: EvidenceItem[];
  trace: AgentTraceItem[];
}

export default function EvidenceDrawer({
  isOpen,
  onClose,
  evidence,
  trace,
}: EvidenceDrawerProps) {
  const [activeTab, setActiveTab] = useState<'evidence' | 'trace'>('evidence');

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="evidence-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Evidence and Audit Trace Drawer"
      >
        <div className="drawer-header">
          <div className="drawer-tabs">
            <button
              className={`drawer-tab ${activeTab === 'evidence' ? 'active' : ''}`}
              onClick={() => setActiveTab('evidence')}
            >
              <FileText size={16} />
              <span>Evidence ({evidence.length})</span>
            </button>
            <button
              className={`drawer-tab ${activeTab === 'trace' ? 'active' : ''}`}
              onClick={() => setActiveTab('trace')}
            >
              <Activity size={16} />
              <span>Agent Trace ({trace.length})</span>
            </button>
          </div>
          <button
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content">
          {activeTab === 'evidence' ? (
            <div className="evidence-list">
              {evidence.length === 0 ? (
                <div className="drawer-empty">
                  <p>No evidence items attached to this response.</p>
                </div>
              ) : (
                evidence.map((item, idx) => (
                  <EvidenceCard key={idx} evidence={item} />
                ))
              )}
            </div>
          ) : (
            <div className="trace-container">
              {trace.length === 0 ? (
                <div className="drawer-empty">
                  <p>No agent trace steps available for this run.</p>
                </div>
              ) : (
                <AgentTimeline trace={trace} />
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
