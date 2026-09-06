import { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import ChatPanel from './components/chat/ChatPanel';
import MapView from './components/map/MapView';
import EvidenceDrawer from './components/evidence/EvidenceDrawer';
import { useChat } from './hooks/useChat';
import { MessageSquare, Map as MapIcon } from 'lucide-react';

/**
 * SAMUDRA Main Application Shell
 *
 * Owned by Dev 1 (Frontend & Geospatial UX Lead).
 * Default Theme: Light Mode
 * Layout: Header + Responsive Main (Desktop Grid / Mobile View Switcher) + Slide-out Evidence Drawer
 */
export default function App() {
  const chat = useChat();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobileView, setMobileView] = useState<'chat' | 'map'>('chat');

  // Synchronize theme on HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const evidenceItems = chat.activeResponse?.evidence ?? [];
  const traceItems = chat.activeResponse?.trace ?? [];
  const layerCount = chat.activeResponse?.map_layers?.length ?? 0;

  const handleBack = () => {
    if (chat.messages.length > 0) {
      chat.clearChat();
    } else if (mobileView === 'chat') {
      setMobileView('map');
    }
  };

  return (
    <div className="app-container">
      {/* Top Navigation & Status Header */}
      <Header
        language={chat.language}
        onLanguageChange={chat.setLanguage}
        evidenceCount={evidenceItems.length}
        onOpenEvidence={() => setIsDrawerOpen(true)}
        theme={theme}
        onThemeToggle={toggleTheme}
      />

      {/* Mobile Segmented View Tabs (Visible only on <= 768px viewports) */}
      <nav className="mobile-view-tabs" role="tablist" aria-label="Mobile viewport selection">
        <button
          className={`mobile-tab-btn ${mobileView === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileView('chat')}
          role="tab"
          aria-selected={mobileView === 'chat'}
        >
          <MessageSquare size={16} />
          <span>Chat</span>
        </button>
        <button
          className={`mobile-tab-btn ${mobileView === 'map' ? 'active' : ''}`}
          onClick={() => setMobileView('map')}
          role="tab"
          aria-selected={mobileView === 'map'}
        >
          <MapIcon size={16} />
          <span>Map</span>
          {layerCount > 0 && <span className="mobile-tab-badge">{layerCount}</span>}
        </button>
      </nav>

      {/* Main Workspace Layout */}
      <main className={`app-main view-${mobileView}`} role="main">
        {/* Left Panel: Conversational Interface */}
        <ChatPanel
          language={chat.language}
          messages={chat.messages}
          activeResponse={chat.activeResponse}
          isLoading={chat.isLoading}
          onSend={chat.send}
          onBack={handleBack}
          onReset={chat.clearChat}
          onEvidenceClick={() => setIsDrawerOpen(true)}
        />

        {/* Right Panel: MapLibre Geospatial Viewport */}
        <MapView
          layers={chat.activeResponse?.map_layers ?? []}
          theme={theme}
        />
      </main>

      {/* Evidence & Trace Provenance Slide-out Drawer */}
      <EvidenceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        evidence={evidenceItems}
        trace={traceItems}
        language={chat.language}
      />
    </div>
  );
}
