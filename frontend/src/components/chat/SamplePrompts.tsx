import { useEffect, useState } from 'react';
import { getDemoScenarios, type DemoScenario } from '../../api/client';
import { Compass, ShieldAlert, Navigation, Fish } from 'lucide-react';

interface SamplePromptsProps {
  onSelect: (query: string) => void;
  disabled?: boolean;
}

interface PromptItem {
  id: string;
  label: string;
  query: string;
  icon?: any;
}

const DEFAULT_CANONICAL_PROMPTS: PromptItem[] = [
  {
    id: 'pfz',
    label: 'Potential Fishing Zone',
    query: 'Where is the nearest Potential Fishing Zone today from Ratnagiri?',
    icon: Fish,
  },
  {
    id: 'safety',
    label: 'Departure Safety Check',
    query: 'Is it safe to leave tomorrow at 6 AM from Ratnagiri?',
    icon: ShieldAlert,
  },
  {
    id: 'hazard',
    label: 'Hazard & Geofence Warning',
    query: 'Any cyclone, lightning or restricted-water risk on this trip?',
    icon: Compass,
  },
  {
    id: 'route',
    label: 'Safer Route Evaluation',
    query: 'Which route from Ratnagiri to the PFZ has the lowest risk?',
    icon: Navigation,
  },
];

export default function SamplePrompts({ onSelect, disabled }: SamplePromptsProps) {
  const [prompts, setPrompts] = useState<PromptItem[]>(DEFAULT_CANONICAL_PROMPTS);

  useEffect(() => {
    let isMounted = true;
    getDemoScenarios()
      .then((scenarios: DemoScenario[]) => {
        if (!isMounted || !scenarios || scenarios.length === 0) return;

        const dynamicPrompts: PromptItem[] = scenarios.map((s) => ({
          id: s.id,
          label: s.name,
          query: s.query || (
            s.intent === 'NEAREST_PFZ'
              ? `Where is the nearest Potential Fishing Zone today? (${s.name})`
              : s.intent === 'HAZARD_BOUNDARY'
              ? `Check hazards and restricted water zones (${s.name})`
              : s.intent === 'SAFER_ROUTE'
              ? `Which alternative route is safer? (${s.name})`
              : `Is it safe to depart? (${s.name})`
          ),
          icon: s.intent === 'NEAREST_PFZ' ? Fish
            : s.intent === 'SAFER_ROUTE' ? Navigation
            : s.intent === 'HAZARD_BOUNDARY' ? Compass
            : ShieldAlert,
        }));

        setPrompts(dynamicPrompts);
      })
      .catch(() => {
        // Keep default prompts if backend scenario endpoint is not responding
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="sample-prompts">
      <h4 className="sample-prompts-title">Canonical Evaluation Queries</h4>
      <div className="sample-prompts-grid">
        {prompts.map((item) => {
          const Icon = item.icon || Compass;
          return (
            <button
              key={item.id}
              className="sample-prompt-btn"
              onClick={() => onSelect(item.query)}
              disabled={disabled}
              aria-label={`Prompt: ${item.query}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon size={14} className="sample-prompt-icon" />
                <span className="sample-prompt-label">{item.label}</span>
              </div>
              <span className="sample-prompt-text">{item.query}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
