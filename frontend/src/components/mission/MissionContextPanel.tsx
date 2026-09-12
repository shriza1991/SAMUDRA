import { Anchor, Building2, Fish, ShipWheel } from 'lucide-react';
import type { DecisionDiff, MissionContext, OperationalRole, WhatIfParameters } from '../../types/mission';
import type { SupportedLanguage } from '../../i18n/translations';
import WhatIfSimulator from './WhatIfSimulator';

interface MissionContextPanelProps {
  context: MissionContext;
  role: OperationalRole;
  currentStatus?: string;
  language?: SupportedLanguage;
  isLoading?: boolean;
  activeDiff?: DecisionDiff | null;
  onContextChange: (context: MissionContext) => void;
  onRoleChange: (role: OperationalRole) => void;
  onSimulate?: (params: WhatIfParameters, queryText: string) => void;
}

const HARBORS = ['Ratnagiri', 'Malvan', 'Panaji', 'Mumbai', 'Veraval', 'Porbandar'];

const CRAFT_PROFILES = [
  { value: 'traditional_non_motorized', label: 'Traditional craft' },
  { value: 'motorized_boat', label: 'Motorized boat' },
  { value: 'mechanized_trawler', label: 'Mechanized trawler' },
] as const;

export default function MissionContextPanel({
  context,
  role,
  currentStatus,
  language = 'en',
  isLoading = false,
  activeDiff,
  onContextChange,
  onRoleChange,
  onSimulate,
}: MissionContextPanelProps) {
  const setHarbor = (origin_harbor: string) => onContextChange({ ...context, origin_harbor });
  const setCraft = (craft_profile: MissionContext['craft_profile']) => onContextChange({ ...context, craft_profile });

  return (
    <section className="mission-context-panel" aria-label="Mission context and dashboard view">
      <div className="mission-context-heading">
        <div>
          <span className="mission-context-eyebrow">Operational dashboard</span>
          <h2>Mission context</h2>
        </div>
        <Anchor size={19} aria-hidden="true" />
      </div>

      <div className="role-switcher" role="group" aria-label="Dashboard view">
        <button
          type="button"
          className={role === 'fisher' ? 'active' : ''}
          onClick={() => onRoleChange('fisher')}
          aria-pressed={role === 'fisher'}
        >
          <Fish size={15} /> Fisher / Skipper
        </button>
        <button
          type="button"
          className={role === 'authority' ? 'active' : ''}
          onClick={() => onRoleChange('authority')}
          aria-pressed={role === 'authority'}
        >
          <Building2 size={15} /> Authority view
        </button>
      </div>

      <div className="mission-context-fields">
        <label>
          <span>Departure harbor</span>
          <select value={context.origin_harbor ?? ''} onChange={(event) => setHarbor(event.target.value)}>
            {HARBORS.map((harbor) => <option key={harbor} value={harbor}>{harbor}</option>)}
          </select>
        </label>
        <label>
          <span><ShipWheel size={13} aria-hidden="true" /> Vessel profile</span>
          <select value={context.craft_profile ?? 'motorized_boat'} onChange={(event) => setCraft(event.target.value as MissionContext['craft_profile'])}>
            {CRAFT_PROFILES.map((profile) => <option key={profile.value} value={profile.value}>{profile.label}</option>)}
          </select>
        </label>
      </div>

      <p className="mission-context-note">
        {role === 'fisher'
          ? 'A clear voyage decision with the essential map and evidence.'
          : 'Expanded evidence, source status, and trace are available for review.'}
      </p>

      {onSimulate && (
        <WhatIfSimulator
          currentContext={context}
          currentStatus={currentStatus}
          language={language}
          isLoading={isLoading}
          activeDiff={activeDiff}
          onSimulate={onSimulate}
          onApplyContext={onContextChange}
        />
      )}
    </section>
  );
}
