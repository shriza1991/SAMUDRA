import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { EvidenceItem, AgentTraceItem } from '../../types/contracts';
import { TRANSLATIONS, type SupportedLanguage } from '../../i18n/translations';
import EvidenceCard from './EvidenceCard';
import AgentTimeline from '../trace/AgentTimeline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="drawer-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
        <DialogPrimitive.Content
          className="evidence-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform"
          aria-describedby={undefined}
        >
          <div className="drawer-header flex items-center justify-between border-b border-border/80 p-3">
            <DialogPrimitive.Title className="sr-only">
              {t.drawerTitleEvidence} & {t.drawerTitleTrace}
            </DialogPrimitive.Title>

            <div className="drawer-tabs flex items-center gap-1">
              <Button
                type="button"
                variant={activeTab === 'evidence' ? 'default' : 'ghost'}
                size="sm"
                className="drawer-tab h-8 gap-1.5 px-3 text-xs font-semibold"
                onClick={() => setActiveTab('evidence')}
              >
                <FileText size={14} />
                <span>{t.drawerTitleEvidence}</span>
                <Badge variant={activeTab === 'evidence' ? 'outline' : 'secondary'} className="h-4 px-1 text-[10px]">
                  {evidence.length}
                </Badge>
              </Button>
              <Button
                type="button"
                variant={activeTab === 'trace' ? 'default' : 'ghost'}
                size="sm"
                className="drawer-tab h-8 gap-1.5 px-3 text-xs font-semibold"
                onClick={() => setActiveTab('trace')}
              >
                <Activity size={14} />
                <span>{t.drawerTitleTrace}</span>
                <Badge variant={activeTab === 'trace' ? 'outline' : 'secondary'} className="h-4 px-1 text-[10px]">
                  {trace.length}
                </Badge>
              </Button>
            </div>

            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="drawer-close-btn size-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Close drawer"
              >
                <X size={16} />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="drawer-content flex-1 overflow-y-auto p-4">
            {activeTab === 'evidence' ? (
              <div className="evidence-list space-y-3">
                {evidence.length === 0 ? (
                  <div className="drawer-empty flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <FileText size={28} className="mb-2 opacity-50" />
                    <p className="text-xs">{t.drawerEmptyEvidence}</p>
                  </div>
                ) : (
                  evidence.map((item, idx) => (
                    <EvidenceCard key={idx} evidence={item} />
                  ))
                )}
              </div>
            ) : (
              <div className="trace-container space-y-3">
                {trace.length === 0 ? (
                  <div className="drawer-empty flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <Activity size={28} className="mb-2 opacity-50" />
                    <p className="text-xs">{t.drawerEmptyTrace}</p>
                  </div>
                ) : (
                  <AgentTimeline trace={trace} />
                )}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
