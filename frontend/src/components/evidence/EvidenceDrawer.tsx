import { useState, useEffect } from 'react';
import type { EvidenceItem, AgentTraceItem } from '../../types/contracts';
import { TRANSLATIONS, type SupportedLanguage } from '../../i18n/translations';
import EvidenceCard from './EvidenceCard';
import AgentTimeline from '../trace/AgentTimeline';
import { X, FileText, Activity } from 'lucide-react';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: EvidenceItem[];
  trace: AgentTraceItem[];
  language?: SupportedLanguage;
}

export default function EvidenceDrawer({
  isOpen,
  onClose,
  evidence,
  trace,
  language = 'en',
}: EvidenceDrawerProps) {
  const [activeTab, setActiveTab] = useState<'evidence' | 'trace'>('evidence');
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Modern dialog interaction: Dismiss on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
              <span>{t.drawerTitleEvidence} ({evidence.length})</span>
            </button>
            <button
              className={`drawer-tab ${activeTab === 'trace' ? 'active' : ''}`}
              onClick={() => setActiveTab('trace')}
            >
              <Activity size={16} />
              <span>{t.drawerTitleTrace} ({trace.length})</span>
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
                  <p>{t.drawerEmptyEvidence}</p>
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
                  <p>{t.drawerEmptyTrace}</p>
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
