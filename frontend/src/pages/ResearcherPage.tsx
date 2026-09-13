import { useState } from 'react';
import {
  Beaker, Waves, Database, FlaskConical, MessageSquareText,
} from 'lucide-react';
import OceanDataExplorer from '../components/researcher/OceanDataExplorer';
import DataSourceMonitor from '../components/researcher/DataSourceMonitor';
import ScenarioLab from '../components/researcher/ScenarioLab';
import QueryWorkbench from '../components/researcher/QueryWorkbench';

type ResearcherDeck = 'ocean' | 'sources' | 'scenarios' | 'query';

const DECKS: { id: ResearcherDeck; label: string; icon: typeof Waves }[] = [
  { id: 'ocean', label: 'Ocean Data', icon: Waves },
  { id: 'sources', label: 'Data Sources', icon: Database },
  { id: 'scenarios', label: 'Scenario Lab', icon: FlaskConical },
  { id: 'query', label: 'Query Workbench', icon: MessageSquareText },
];

export default function ResearcherPage() {
  const [activeDeck, setActiveDeck] = useState<ResearcherDeck>('ocean');

  return (
    <div className="researcher-page">
      {/* Command Bar */}
      <div className="researcher-command-bar">
        <div className="researcher-bar-left">
          <Beaker size={16} className="researcher-bar-icon" />
          <span className="researcher-bar-title">Researcher Lab</span>
        </div>

        <nav className="researcher-nav-segmented" role="tablist" aria-label="Research deck navigation">
          {DECKS.map(d => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                className={`researcher-segment-btn ${activeDeck === d.id ? 'active' : ''}`}
                onClick={() => setActiveDeck(d.id)}
                role="tab"
                aria-selected={activeDeck === d.id}
              >
                <Icon size={14} />
                <span>{d.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Deck Content */}
      <div className="researcher-deck-content">
        {activeDeck === 'ocean' && <OceanDataExplorer />}
        {activeDeck === 'sources' && <DataSourceMonitor />}
        {activeDeck === 'scenarios' && <ScenarioLab />}
        {activeDeck === 'query' && <QueryWorkbench />}
      </div>
    </div>
  );
}
