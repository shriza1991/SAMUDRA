import { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import PortalPage from './pages/PortalPage';
import FisherPage from './pages/FisherPage';
import AuthorityPage from './pages/AuthorityPage';
import EvidenceDrawer from './components/evidence/EvidenceDrawer';
import CallModal from './components/call/CallModal';
import { useChat } from './hooks/useChat';
import { MessageSquare, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type PortalMode = 'selection' | 'fisher' | 'authority';

/**
 * SAMUDRA Main Application Shell
 *
 * Owned by Dev 1 (Frontend & Geospatial UX Lead).
 * Default Theme: Light Mode
 * Features:
 *   - Landing Portal Page (Selection between Fisher Console & Authority Deck)
 *   - Fisher Console Page
 *   - Authority Command Deck Page
 *   - Shared Map, Evidence Drawer, and Voice Call Modal
 */
export default function App() {
  const chat = useChat();
  const [portal, setPortal] = useState<PortalMode>('selection');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
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
    <TooltipProvider>
      <div className="app-container flex h-screen flex-col bg-background text-foreground">
        {/* Top Navigation & Status Header */}
        <Header
          language={chat.language}
          onLanguageChange={chat.setLanguage}
          evidenceCount={evidenceItems.length}
          onOpenEvidence={() => setIsDrawerOpen(true)}
          onStartCall={() => setIsCallModalOpen(true)}
          theme={theme}
          onThemeToggle={toggleTheme}
          currentPortal={portal}
          onLogout={() => setPortal('selection')}
          onReturnToPortal={() => setPortal('selection')}
        />

        {/* Mobile Segmented View Tabs (Visible only on <= 768px viewports when in a role console) */}
        {portal !== 'selection' && (
          <nav className="mobile-view-tabs flex items-center justify-center gap-1 border-b border-border bg-card/60 p-1.5 md:hidden" role="tablist" aria-label="Mobile viewport selection">
            <Button
              type="button"
              variant={mobileView === 'chat' ? 'default' : 'ghost'}
              size="sm"
              className={cn('mobile-tab-btn flex-1 h-8 gap-1.5 text-xs font-semibold', mobileView === 'chat' && 'active shadow-xs')}
              onClick={() => setMobileView('chat')}
              role="tab"
              aria-selected={mobileView === 'chat'}
            >
              <MessageSquare size={14} />
              <span>Chat</span>
            </Button>
            <Button
              type="button"
              variant={mobileView === 'map' ? 'default' : 'ghost'}
              size="sm"
              className={cn('mobile-tab-btn flex-1 h-8 gap-1.5 text-xs font-semibold', mobileView === 'map' && 'active shadow-xs')}
              onClick={() => setMobileView('map')}
              role="tab"
              aria-selected={mobileView === 'map'}
            >
              <MapIcon size={14} />
              <span>Map</span>
              {layerCount > 0 && (
                <Badge variant={mobileView === 'map' ? 'outline' : 'secondary'} className="mobile-tab-badge h-4 px-1 text-[10px]">
                  {layerCount}
                </Badge>
              )}
            </Button>
          </nav>
        )}

        {/* Pages: Portal Selection vs. Fisher Console vs. Authority Command Deck */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {portal === 'selection' ? (
            <PortalPage onSelectRole={(selected) => setPortal(selected)} language={chat.language} />
          ) : portal === 'fisher' ? (
            <FisherPage
              chat={chat}
              theme={theme}
              mobileView={mobileView}
              onStartCall={() => setIsCallModalOpen(true)}
              onOpenEvidence={() => setIsDrawerOpen(true)}
              onBack={handleBack}
            />
          ) : (
            <AuthorityPage
              chat={chat}
              theme={theme}
              mobileView={mobileView}
              onOpenEvidence={() => setIsDrawerOpen(true)}
              onBack={handleBack}
            />
          )}
        </div>

        {/* Evidence & Trace Provenance Slide-out Drawer */}
        <EvidenceDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          evidence={evidenceItems}
          trace={traceItems}
          language={chat.language}
        />

        {/* Dedicated Phone-Style Call SAMUDRA Modal */}
        <CallModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          language={chat.language}
          originHarbor={chat.missionContext.origin_harbor}
          craftProfile={chat.missionContext.craft_profile}
        />
      </div>
    </TooltipProvider>
  );
}
