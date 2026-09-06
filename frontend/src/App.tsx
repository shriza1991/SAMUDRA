import { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import ChatPanel from './components/chat/ChatPanel';
import MapView from './components/map/MapView';
import EvidenceDrawer from './components/evidence/EvidenceDrawer';
import { useChat } from './hooks/useChat';

/**
 * SAMUDRA Main Application Shell
 *
 * Owned by Dev 1 (Frontend & Geospatial UX Lead).
 * Default Theme: Light Mode
 * Layout: Header + Left Panel (Chat/Recommendation) + Right Panel (Map) + Slide-out Evidence/Trace Drawer
 */
export default function App() {
  const chat = useChat();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Synchronize theme on HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const evidenceItems = chat.activeResponse?.evidence ?? [];
  const traceItems = chat.activeResponse?.trace ?? [];

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

      {/* Main Workspace Layout */}
      <main className="app-main" role="main">
        {/* Left Panel: Conversational Interface */}
        <ChatPanel
          language={chat.language}
          messages={chat.messages}
          activeResponse={chat.activeResponse}
          isLoading={chat.isLoading}
          onSend={chat.send}
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
