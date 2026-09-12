import { useState, useMemo, useEffect } from 'react';
import { MessageSquare, SlidersHorizontal, Anchor } from 'lucide-react';
import ChatPanel from '../components/chat/ChatPanel';
import MapView from '../components/map/MapView';
import MissionContextPanel from '../components/mission/MissionContextPanel';
import type { useChat } from '../hooks/useChat';
import type { MapLayer } from '../types/contracts';
import { createHarborLayer, getHarborCoordinates, fetchAndFormatBaseLayers } from '../utils/geo';

export interface FisherPageProps {
  chat: ReturnType<typeof useChat>;
  theme: 'light' | 'dark';
  mobileView: 'chat' | 'map';
  onStartCall: () => void;
  onOpenEvidence: () => void;
  onBack: () => void;
}

function formatCraft(profile?: string): string {
  if (profile === 'traditional_non_motorized') return 'Traditional';
  if (profile === 'mechanized_trawler') return 'Trawler';
  return 'Motorized';
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
    <main className={`app-main fisher-page view-${mobileView}`} role="main">
      <div className="mission-workspace">
        {/* Sleek, minimal sidebar view switcher */}
        <div className="fisher-sidebar-header">
          <div className="fisher-tab-switch" role="tablist" aria-label="Fisher console views">
            <button
              type="button"
              className={`fisher-tab-btn ${sidebarTab === 'chat' ? 'active' : ''}`}
              onClick={() => setSidebarTab('chat')}
              role="tab"
              aria-selected={sidebarTab === 'chat'}
            >
              <MessageSquare size={13} />
              <span>Advisory Chat</span>
            </button>
            <button
              type="button"
              className={`fisher-tab-btn ${sidebarTab === 'voyage' ? 'active' : ''}`}
              onClick={() => setSidebarTab('voyage')}
              role="tab"
              aria-selected={sidebarTab === 'voyage'}
            >
              <SlidersHorizontal size={13} />
              <span>Voyage Settings</span>
            </button>
          </div>

          <button
            type="button"
            className="fisher-compact-context-pill"
            onClick={() => setSidebarTab(sidebarTab === 'chat' ? 'voyage' : 'chat')}
            title="Toggle voyage settings"
          >
            <Anchor size={11} className="context-pill-icon" />
            <span className="context-pill-text">{originHarbor} · {formatCraft(chat.missionContext.craft_profile)}</span>
          </button>
        </div>

        {/* Tab content: full-height chat or focused voyage configuration */}
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
          <div className="fisher-voyage-pane">
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

      <MapView
        layers={effectiveLayers}
        theme={theme}
        center={harborCoords}
        zoom={9.5}
      />
    </main>
  );
}
