import { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  FileCheck2,
  FlaskConical,
  RadioTower,
  RotateCcw,
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface AuthorityPageProps {
  chat: ReturnType<typeof useChat>;
  theme: 'light' | 'dark';
  mobileView: 'chat' | 'map';
  onOpenEvidence: () => void;
  onBack: () => void;
  className?: string;
}

export type AuthorityTab = 'terminal' | 'fleet' | 'benchmarks' | 'audit';

const SECTORS = [
  'Ratnagiri Sector (MH-03)',
  'Malvan Marine Zone (MH-04)',
  'Goa Naval Corridor (GA-01)',
  'Mumbai Offshore (MH-01)',
  'Veraval Coastal Zone (GJ-02)',
];

export default function AuthorityPage({
  chat,
  theme,
  mobileView,
  onOpenEvidence,
  onBack,
  className,
}: AuthorityPageProps) {
  const [selectedSector, setSelectedSector] = useState(SECTORS[0]);
  const [authorityTab, setAuthorityTab] = useState<AuthorityTab>('terminal');
  const [replayLayer, setReplayLayer] = useState<MapLayer | null>(null);
  const [baseLayers, setBaseLayers] = useState<MapLayer[]>([]);

  useEffect(() => {
    fetchAndFormatBaseLayers().then(setBaseLayers);
  }, []);

  const sectorConfig = useMemo(() => getSectorConfig(selectedSector), [selectedSector]);

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

  const getStatusBadgeVariant = (st: string): 'go' | 'caution' | 'noGo' | 'unknown' | 'secondary' => {
    const s = st.toUpperCase();
    if (s.includes('GO') && !s.includes('NO')) return 'go';
    if (s.includes('CAUTION')) return 'caution';
    if (s.includes('NO')) return 'noGo';
    if (s.includes('UNKNOWN')) return 'unknown';
    return 'secondary';
  };

  return (
    <div className={cn('authority-page flex-1 flex flex-col overflow-hidden', `view-${mobileView}`, className)} role="region" aria-label="Authority Command Deck">
      {/* Top Authority Command Bar */}
      <section className="authority-command-bar flex flex-wrap items-center justify-between border-b border-border bg-card/70 px-4 py-2 gap-3" aria-label="Operational Command Bar">
        <div className="authority-bar-left flex flex-wrap items-center gap-3">
          <div className="authority-title-row flex items-center gap-2 font-bold text-xs sm:text-sm text-foreground">
            <Building2 size={16} className="authority-brand-icon text-primary" />
            <span className="authority-title">{translateText('Authority Command Deck', chat.language)}</span>
          </div>

          <div className="authority-sector-selector flex items-center gap-1.5">
            <span className="sector-label text-[11px] font-semibold text-muted-foreground">{translateText('Sector:', chat.language)}</span>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="authority-sector-select h-7 text-xs bg-background min-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Compact KPI Pills in a single clean row */}
        <div className="authority-kpi-chips flex items-center gap-1.5 flex-wrap">
          <Badge variant={getStatusBadgeVariant(status)} className="authority-kpi-chip h-6 gap-1 text-[11px] font-bold">
            <span className="opacity-80 font-normal">{translateText('Verdict:', chat.language)}</span>
            <span>{status.replace('_', '-')}</span>
          </Badge>

          <Badge variant="outline" className="authority-kpi-chip h-6 gap-1 text-[11px]">
            <AlertTriangle size={12} className={hazardLayers.length > 0 ? 'text-rose-500' : 'text-muted-foreground'} />
            <span><strong>{hazardLayers.length}</strong> {translateText('Hazards', chat.language)}</span>
          </Badge>

          <Badge variant="outline" className="authority-kpi-chip h-6 gap-1 text-[11px]">
            <FileCheck2 size={12} className="text-primary" />
            <span><strong>{evidenceList.length}</strong> {translateText('Sources', chat.language)}</span>
          </Badge>

          <Badge variant="outline" className="authority-kpi-chip h-6 gap-1 text-[11px]">
            <Activity size={12} className="text-primary" />
            <span><strong>{traceList.length}</strong> {translateText('Steps', chat.language)}</span>
          </Badge>
        </div>
      </section>

      {/* Authority View Switcher Tabs */}
      <nav className="authority-tab-nav flex items-center gap-1 border-b border-border bg-background/50 px-4 py-1.5" role="tablist" aria-label="Authority sub-views">
        <Button
          type="button"
          variant={authorityTab === 'terminal' ? 'default' : 'ghost'}
          size="sm"
          className={cn('authority-tab-btn h-7 gap-1.5 px-2.5 text-xs font-semibold', authorityTab === 'terminal' && 'active shadow-xs')}
          onClick={() => setAuthorityTab('terminal')}
          role="tab"
          aria-selected={authorityTab === 'terminal'}
        >
          <RadioTower size={13} />
          <span>{translateText('Audit Terminal', chat.language)}</span>
        </Button>
        <Button
          type="button"
          variant={authorityTab === 'fleet' ? 'default' : 'ghost'}
          size="sm"
          className={cn('authority-tab-btn h-7 gap-1.5 px-2.5 text-xs font-semibold', authorityTab === 'fleet' && 'active shadow-xs')}
          onClick={() => setAuthorityTab('fleet')}
          role="tab"
          aria-selected={authorityTab === 'fleet'}
        >
          <Ship size={13} />
          <span>{translateText('Fleet Surveillance', chat.language)}</span>
        </Button>
        <Button
          type="button"
          variant={authorityTab === 'benchmarks' ? 'default' : 'ghost'}
          size="sm"
          className={cn('authority-tab-btn h-7 gap-1.5 px-2.5 text-xs font-semibold', authorityTab === 'benchmarks' && 'active shadow-xs')}
          onClick={() => setAuthorityTab('benchmarks')}
          role="tab"
          aria-selected={authorityTab === 'benchmarks'}
        >
          <FlaskConical size={13} />
          <span>{translateText('Benchmark Runner', chat.language)}</span>
        </Button>
        <Button
          type="button"
          variant={authorityTab === 'audit' ? 'default' : 'ghost'}
          size="sm"
          className={cn('authority-tab-btn h-7 gap-1.5 px-2.5 text-xs font-semibold', authorityTab === 'audit' && 'active shadow-xs')}
          onClick={() => setAuthorityTab('audit')}
          role="tab"
          aria-selected={authorityTab === 'audit'}
        >
          <FileCheck2 size={13} />
          <span>{translateText('Evidence & Trace', chat.language)}</span>
          <Badge variant={authorityTab === 'audit' ? 'outline' : 'secondary'} className="h-3.5 px-1 text-[9px]">
            {traceList.length}
          </Badge>
        </Button>
      </nav>

      {/* Workspace Body */}
      <div className="authority-body flex-1 overflow-hidden">
        {authorityTab === 'terminal' && (
          <div className="authority-workspace-grid flex h-full overflow-hidden">
            <aside className="authority-terminal-pane flex flex-col border-r border-border bg-card/40 w-full md:w-[460px] lg:w-[480px] shrink-0" aria-label="Terminal Pane">
              <div className="authority-terminal-header flex items-center justify-between border-b border-border/80 bg-background/50 px-3 py-2 text-xs font-semibold text-foreground">
                <span>{translateText('Surveillance Query Terminal', chat.language)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="authority-reset-btn h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={chat.clearChat}
                  title="Clear audit session"
                >
                  <RotateCcw size={12} /> {translateText('Reset', chat.language)}
                </Button>
              </div>

              <div className="flex-1 overflow-hidden">
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
              </div>
            </aside>

            <div className="authority-map-pane flex-1 relative">
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
          <div className="authority-workspace-grid authority-fleet-grid flex h-full overflow-hidden">
            <aside className="authority-fleet-pane flex-1 overflow-y-auto p-4 border-r border-border bg-card/30" aria-label="Fleet Surveillance Pane">
              <FleetTrackingDeck onReplayUpdate={setReplayLayer} language={chat.language} />
            </aside>
            <div className="authority-map-pane flex-1 relative hidden lg:block">
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
          <div className="authority-benchmarks-container h-full overflow-y-auto p-4 max-w-6xl mx-auto">
            <ScenarioBenchmarkDeck language={chat.language} />
          </div>
        )}

        {authorityTab === 'audit' && (
          <div className="authority-audit-view h-full overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            <div className="authority-audit-column space-y-4">
              <div className="audit-section-header flex items-center gap-2 border-b border-border/80 pb-2 font-bold text-sm text-foreground">
                <FileCheck2 size={16} className="text-primary" />
                <h3>{translateText('Verified Official Evidence', chat.language)} ({evidenceList.length})</h3>
              </div>
              {evidenceList.length > 0 ? (
                <div className="authority-evidence-grid space-y-3">
                  {evidenceList.map((ev, idx) => (
                    <EvidenceCard key={idx} evidence={ev} />
                  ))}
                </div>
              ) : (
                <p className="authority-empty-note text-xs text-muted-foreground">
                  {translateText('No active evidence items. Run an advisory query to inspect official telemetry.', chat.language)}
                </p>
              )}

              {warningsList.length > 0 && (
                <Card className="authority-warnings-box border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                    {translateText('Active System Warnings & Fallbacks', chat.language)}
                  </h4>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                    {warningsList.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            <div className="authority-audit-column space-y-4">
              <div className="audit-section-header flex items-center gap-2 border-b border-border/80 pb-2 font-bold text-sm text-foreground">
                <Activity size={16} className="text-primary" />
                <h3>{translateText('Autonomous Agent Execution Trail', chat.language)} ({traceList.length} {translateText('Steps', chat.language)})</h3>
              </div>
              {traceList.length > 0 ? (
                <Card className="authority-timeline-card border-border/80 bg-card/60 p-4">
                  <AgentTimeline trace={traceList} />
                </Card>
              ) : (
                <p className="authority-empty-note text-xs text-muted-foreground">
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
