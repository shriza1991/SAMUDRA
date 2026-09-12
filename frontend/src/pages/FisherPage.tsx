import ChatPanel from '../components/chat/ChatPanel';
import MapView from '../components/map/MapView';
import MissionContextPanel from '../components/mission/MissionContextPanel';
import OperationalSnapshot from '../components/mission/OperationalSnapshot';
import type { useChat } from '../hooks/useChat';

export interface FisherPageProps {
  chat: ReturnType<typeof useChat>;
  theme: 'light' | 'dark';
  mobileView: 'chat' | 'map';
  onStartCall: () => void;
  onOpenEvidence: () => void;
  onBack: () => void;
}

/**
 * Fisher / Skipper Mission Page
 *
 * Tailored for vessel skippers, boat operators, and artisanal fishers.
 * Reuses ChatPanel, MapView, MissionContextPanel, and OperationalSnapshot.
 */
export default function FisherPage({
  chat,
  theme,
  mobileView,
  onStartCall,
  onOpenEvidence,
  onBack,
}: FisherPageProps) {
  return (
    <main className={`app-main fisher-page view-${mobileView}`} role="main">
      <div className="mission-workspace">
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

        <OperationalSnapshot
          role="fisher"
          context={chat.missionContext}
          response={chat.activeResponse}
          onOpenEvidence={onOpenEvidence}
        />

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
      </div>

      <MapView
        layers={chat.activeResponse?.map_layers ?? []}
        theme={theme}
      />
    </main>
  );
}
