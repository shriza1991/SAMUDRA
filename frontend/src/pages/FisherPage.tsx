import { useState, useMemo, useEffect } from 'react';
import { MessageSquare, SlidersHorizontal, Anchor } from 'lucide-react';
import ChatPanel from '../components/chat/ChatPanel';
import MapView from '../components/map/MapView';
import MissionContextPanel from '../components/mission/MissionContextPanel';
import type { useChat } from '../hooks/useChat';
import type { MapLayer } from '../types/contracts';
import { createHarborLayer, getHarborCoordinates, fetchAndFormatBaseLayers } from '../utils/geo';
import { translateText } from '../i18n/translations';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FisherPageProps {
  chat: ReturnType<typeof useChat>;
  theme: 'light' | 'dark';
  mobileView: 'chat' | 'map';
  onStartCall: () => void;
  onOpenEvidence: () => void;
  onBack: () => void;
  className?: string;
}

function formatCraft(profile: string | undefined, lang: any): string {
  if (profile === 'traditional_non_motorized') return translateText('Traditional', lang);
  if (profile === 'mechanized_trawler') return translateText('Trawler', lang);
  return translateText('Motorized', lang);
}

/**
 * Fisher / Skipper Mission Page
 *
 * Tailored for vessel skippers, boat operators, and artisanal fishers.
 * Uncluttered layout: spacious Advisory Chat by default with quick toggle to Voyage Context & What-If.
 */
export default function FisherPage({
  chat,
  theme,
  mobileView,
  onStartCall,
  onOpenEvidence,
  onBack,
  className,
}: FisherPageProps) {
  const originHarbor = chat.missionContext.origin_harbor || 'Ratnagiri';
  const harborCoords = useMemo(() => getHarborCoordinates(originHarbor), [originHarbor]);
  const status = chat.activeResponse?.recommendation.status ?? 'GO';
  const [baseLayers, setBaseLayers] = useState<MapLayer[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'voyage'>('chat');

  useEffect(() => {
    fetchAndFormatBaseLayers().then(setBaseLayers);
  }, []);

  // Construct active layers: Ensure departure harbor station and base boundaries are always visible & interactive
  const effectiveLayers = useMemo(() => {
    const responseLayers = chat.activeResponse?.map_layers ?? [];
    const hasOriginLayer = responseLayers.some(
      (l) => l.layer_id.includes('origin') || l.layer_id.includes('vessel_position') || l.layer_id.includes('harbor')
    );

    const baselineHarborLayer = hasOriginLayer ? [] : [createHarborLayer(originHarbor, status)];
    return [...baseLayers, ...baselineHarborLayer, ...responseLayers];
  }, [baseLayers, chat.activeResponse?.map_layers, originHarbor, status]);

  return (
    <main className={cn('app-main fisher-page flex-1 flex overflow-hidden', `view-${mobileView}`, className)} role="main">
      <div className="mission-workspace flex flex-col border-r border-border bg-card/40 w-full md:w-[460px] lg:w-[480px] shrink-0">
        {/* Sleek, minimal sidebar view switcher */}
        <div className="fisher-sidebar-header flex items-center justify-between border-b border-border/80 bg-background/50 p-2.5">
          <div className="fisher-tab-switch flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-0.5" role="tablist" aria-label="Fisher console views">
            <Button
              type="button"
              variant={sidebarTab === 'chat' ? 'default' : 'ghost'}
              size="sm"
              className={cn('fisher-tab-btn h-7 gap-1.5 px-2.5 text-xs font-semibold', sidebarTab === 'chat' && 'active shadow-xs')}
              onClick={() => setSidebarTab('chat')}
              role="tab"
              aria-selected={sidebarTab === 'chat'}
            >
              <MessageSquare size={13} />
              <span>{translateText('Advisory Chat', chat.language)}</span>
            </Button>
            <Button
              type="button"
              variant={sidebarTab === 'voyage' ? 'default' : 'ghost'}
              size="sm"
              className={cn('fisher-tab-btn h-7 gap-1.5 px-2.5 text-xs font-semibold', sidebarTab === 'voyage' && 'active shadow-xs')}
              onClick={() => setSidebarTab('voyage')}
              role="tab"
              aria-selected={sidebarTab === 'voyage'}
            >
              <SlidersHorizontal size={13} />
              <span>{translateText('Voyage Settings', chat.language)}</span>
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="fisher-compact-context-pill h-7 gap-1.5 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarTab(sidebarTab === 'chat' ? 'voyage' : 'chat')}
            title={translateText('Toggle voyage settings', chat.language)}
          >
            <Anchor size={11} className="context-pill-icon text-primary" />
            <span className="context-pill-text truncate max-w-[140px]">
              {translateText(originHarbor, chat.language)} · {formatCraft(chat.missionContext.craft_profile, chat.language)}
            </span>
          </Button>
        </div>

        {/* Tab content: full-height chat or focused voyage configuration */}
        <div className="flex-1 overflow-hidden">
          {sidebarTab === 'chat' ? (
            <ChatPanel
              language={chat.language}
              messages={chat.messages}
              activeResponse={chat.activeResponse}
              isLoading={chat.isLoading}
              onSend={chat.send}
              onStartCall={onStartCall}
              onBack={onBack}
              onReset={chat.clearChat}
              onEvidenceClick={onOpenEvidence}
            />
          ) : (
            <div className="fisher-voyage-pane h-full overflow-y-auto p-4">
              <MissionContextPanel
                context={chat.missionContext}
                role="fisher"
                currentStatus={chat.activeResponse?.recommendation.status}
                language={chat.language}
                isLoading={chat.isLoading}
                activeDiff={chat.activeDiff}
                onContextChange={chat.setMissionContext}
                onSimulate={chat.simulateWhatIf}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <MapView
          layers={effectiveLayers}
          theme={theme}
          center={harborCoords}
          zoom={9.5}
          language={chat.language}
        />
      </div>
    </main>
  );
}
