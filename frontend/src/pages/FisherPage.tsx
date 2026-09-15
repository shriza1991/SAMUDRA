import { useState, useMemo, useEffect } from 'react';
import { MessageSquare, SlidersHorizontal, Anchor } from 'lucide-react';
import ChatPanel from '../components/chat/ChatPanel';
import MapView from '../components/map/MapView';
import MissionContextPanel from '../components/mission/MissionContextPanel';
import FisherDecisionSurface from '../components/fisher/FisherDecisionSurface';
import type { useChat } from '../hooks/useChat';
import type { MapLayer } from '../types/contracts';
import { getHarborCoordinates, fetchAndFormatBaseLayers, createAuthorityRouteLayers } from '../utils/geo';
import {
  createPFZMapLayers,
  createHazardMapLayers,
  mergeFisherLayers,
  formatFishermanPopup,
} from '../utils/fisher-map';
import { getDemoRouteAlternatives } from '../api/client';
import { fetchPFZCandidates, fetchHazards } from '../api/researcher-client';
import { translateText } from '../i18n/translations';

export interface FisherPageProps {
  chat: ReturnType<typeof useChat>;
  theme: 'light' | 'dark';
  mobileView: 'chat' | 'map';
  onStartCall: () => void;
  onOpenEvidence: () => void;
  onBack: () => void;
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
 * Primary Decision Surface answering "Can I go right now, and why?" sits prominently at top.
 * Spacious Advisory Chat & Voyage Context tabs remain below.
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
  const status = chat.activeResponse?.recommendation.status ?? 'UNKNOWN';
  const [baseLayers, setBaseLayers] = useState<MapLayer[]>([]);
  const [baselineRoutes, setBaselineRoutes] = useState<MapLayer[]>([]);
  const [baselinePFZ, setBaselinePFZ] = useState<MapLayer[]>([]);
  const [baselineHazards, setBaselineHazards] = useState<MapLayer[]>([]);
  const [layerAvailability, setLayerAvailability] = useState<{
    pfz?: 'AVAILABLE' | 'UNAVAILABLE' | 'EMPTY';
    routes?: 'AVAILABLE' | 'UNAVAILABLE' | 'EMPTY';
    hazards?: 'AVAILABLE' | 'UNAVAILABLE' | 'EMPTY';
  }>({});
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'voyage'>('chat');

  // Extract any transient error on the latest message
  const lastMsg = chat.messages[chat.messages.length - 1];
  const chatError = lastMsg?.role === 'assistant' && lastMsg.error ? lastMsg.error : null;

  // 1. Fetch base geofences & boundaries
  useEffect(() => {
    fetchAndFormatBaseLayers()
      .then(setBaseLayers)
      .catch(() => setBaseLayers([]));
  }, []);

  // 2. Fetch baseline route alternatives independently (without fabricating any vessel_id)
  useEffect(() => {
    let isCancelled = false;
    getDemoRouteAlternatives({
      origin_harbor: originHarbor,
      craft_profile: chat.missionContext.craft_profile,
    })
      .then((res) => {
        if (isCancelled) return;
        if (res.status === 'AVAILABLE' && Array.isArray(res.routes) && res.routes.length > 0) {
          const routeLayers = createAuthorityRouteLayers(
            res.routes,
            res.recommended_route_id,
            res.origin,
            res.destination
          );
          setBaselineRoutes(routeLayers);
          setLayerAvailability((prev) => ({ ...prev, routes: 'AVAILABLE' }));
        } else if (res.status === 'NO_ROUTE') {
          setBaselineRoutes([]);
          setLayerAvailability((prev) => ({ ...prev, routes: 'EMPTY' }));
        } else {
          setBaselineRoutes([]);
          setLayerAvailability((prev) => ({ ...prev, routes: 'UNAVAILABLE' }));
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setBaselineRoutes([]);
        setLayerAvailability((prev) => ({ ...prev, routes: 'UNAVAILABLE' }));
      });

    return () => {
      isCancelled = true;
    };
  }, [originHarbor, chat.missionContext.craft_profile]);

  // 3. Fetch baseline PFZ candidates independently
  useEffect(() => {
    let isCancelled = false;
    fetchPFZCandidates()
      .then((candidates) => {
        if (isCancelled) return;
        if (Array.isArray(candidates) && candidates.length > 0) {
          setBaselinePFZ(createPFZMapLayers(candidates));
          setLayerAvailability((prev) => ({ ...prev, pfz: 'AVAILABLE' }));
        } else {
          setBaselinePFZ([]);
          setLayerAvailability((prev) => ({ ...prev, pfz: 'EMPTY' }));
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setBaselinePFZ([]);
        setLayerAvailability((prev) => ({ ...prev, pfz: 'UNAVAILABLE' }));
      });

    return () => {
      isCancelled = true;
    };
  }, [originHarbor]);

  // 4. Fetch baseline hazards independently
  useEffect(() => {
    let isCancelled = false;
    fetchHazards()
      .then((hazards) => {
        if (isCancelled) return;
        if (Array.isArray(hazards) && hazards.length > 0) {
          setBaselineHazards(createHazardMapLayers(hazards));
          setLayerAvailability((prev) => ({ ...prev, hazards: 'AVAILABLE' }));
        } else {
          setBaselineHazards([]);
          setLayerAvailability((prev) => ({ ...prev, hazards: 'EMPTY' }));
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setBaselineHazards([]);
        setLayerAvailability((prev) => ({ ...prev, hazards: 'UNAVAILABLE' }));
      });

    return () => {
      isCancelled = true;
    };
  }, [originHarbor]);

  // Merge layers with strict de-duplication: chat response layers take precedence over baseline layers
  const effectiveLayers = useMemo(() => {
    return mergeFisherLayers({
      baseLayers,
      harborCoords,
      originHarbor,
      status,
      baselineRoutes,
      baselinePFZ,
      baselineHazards,
      chatLayers: chat.activeResponse?.map_layers,
    });
  }, [
    baseLayers,
    harborCoords,
    originHarbor,
    status,
    baselineRoutes,
    baselinePFZ,
    baselineHazards,
    chat.activeResponse?.map_layers,
  ]);

  return (
    <main className={`app-main fisher-page view-${mobileView}`} role="main">
      <div className="mission-workspace">
        {/* P0-22: Primary Fisherman Decision Surface & Essential Conditions */}
        <FisherDecisionSurface
          activeResponse={chat.activeResponse}
          isLoading={chat.isLoading}
          error={chatError}
          activeDiff={chat.activeDiff}
          missionContext={chat.missionContext}
          language={chat.language}
          onOpenVoyageSettings={() => setSidebarTab('voyage')}
        />

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
              <span>{translateText('Advisory Chat', chat.language)}</span>
            </button>
            <button
              type="button"
              className={`fisher-tab-btn ${sidebarTab === 'voyage' ? 'active' : ''}`}
              onClick={() => setSidebarTab('voyage')}
              role="tab"
              aria-selected={sidebarTab === 'voyage'}
            >
              <SlidersHorizontal size={13} />
              <span>{translateText('Voyage Settings', chat.language)}</span>
            </button>
          </div>

          <button
            type="button"
            className="fisher-compact-context-pill"
            onClick={() => setSidebarTab(sidebarTab === 'chat' ? 'voyage' : 'chat')}
            title={translateText('Toggle voyage settings', chat.language)}
          >
            <Anchor size={11} className="context-pill-icon" />
            <span className="context-pill-text">
              {translateText(originHarbor, chat.language)} · {formatCraft(chat.missionContext.craft_profile, chat.language)}
            </span>
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
        language={chat.language}
        customPopupRenderer={formatFishermanPopup}
        layerAvailability={layerAvailability}
      />
    </main>
  );
}
