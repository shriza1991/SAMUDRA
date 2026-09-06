import { useState } from 'react';
import Header from './components/layout/Header';
import ChatPanel from './components/chat/ChatPanel';
import MapView from './components/map/MapView';
import EvidenceDrawer from './components/evidence/EvidenceDrawer';
import { useChat } from './hooks/useChat';
import { TRANSLATIONS } from './i18n/translations';

/**
 * SAMUDRA Main Application Shell
 *
 * Owned by Dev 1 (Frontend & Geospatial UX Lead).
 * Layout: Header + Left Panel (Chat/Recommendation) + Right Panel (Map) + Slide-out Evidence/Trace Drawer
 */
export default function App() {
  const chat = useChat();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const evidenceItems = chat.activeResponse?.evidence ?? [];
  const traceItems = chat.activeResponse?.trace ?? [];
  const t = TRANSLATIONS[chat.language] || TRANSLATIONS.en;

  return (
    <div className="app-container">
      {/* Top Navigation & Status Header */}
      <Header
        language={chat.language}
        onLanguageChange={chat.setLanguage}
        evidenceCount={evidenceItems.length}
        onOpenEvidence={() => setIsDrawerOpen(true)}
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
        <MapView layers={chat.activeResponse?.map_layers ?? []} />
      </main>

      {/* Evidence & Trace Provenance Slide-out Drawer */}
      <EvidenceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        evidence={evidenceItems}
        trace={traceItems}
        language={chat.language}
      />

      {/* Persistent Prototype Disclaimer */}
      <footer className="prototype-disclaimer" role="contentinfo">
        {t.disclaimerText}
      </footer>
    </div>
  );
}
