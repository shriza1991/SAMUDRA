import ChatPanel from './components/chat/ChatPanel';
import MapView from './components/map/MapView';
import { useChat } from './hooks/useChat';

/**
 * SAMUDRA Main Application Shell
 *
 * Owned by Dev 1 (Frontend & Geospatial UX Lead).
 * Layout: Header + Left Panel (Chat/Recommendation) + Right Panel (Map)
 */
export default function App() {
  const chat = useChat();

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">
            SAMUDRA{' '}
            <span className="app-subtitle">| SIH 2026 PS 26176 (ISRO)</span>
          </h1>
          <p className="app-tagline">
            Smart Autonomous Marine Understanding, Decision &amp; Risk Assistant
          </p>
        </div>
        <div className="app-header-right">
          <span className="mode-badge">Mode: HYBRID</span>
          <span className="status-badge-ready">Prototype</span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="app-main">
        {/* Left Panel: Conversational Interface */}
        <ChatPanel
          messages={chat.messages}
          activeResponse={chat.activeResponse}
          isLoading={chat.isLoading}
          onSend={chat.send}
        />

        {/* Right Panel: MapLibre Geospatial Viewport */}
        <MapView layers={chat.activeResponse?.map_layers ?? []} />
      </main>

      {/* Prototype Disclaimer */}
      <div className="prototype-disclaimer">
        ⚠️ Prototype only — not an operational marine-navigation or life-safety system
      </div>
    </div>
  );
}
