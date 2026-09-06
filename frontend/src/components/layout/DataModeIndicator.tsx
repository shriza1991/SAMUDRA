import { Database, ShieldCheck } from 'lucide-react';

interface DataModeIndicatorProps {
  mode?: 'LIVE' | 'HYBRID' | 'SNAPSHOT';
  pilotArea?: string;
}

export default function DataModeIndicator({
  mode = 'HYBRID',
  pilotArea = 'Maharashtra (Ratnagiri)',
}: DataModeIndicatorProps) {
  const getModeClass = () => {
    switch (mode) {
      case 'LIVE':
        return 'mode-live';
      case 'HYBRID':
        return 'mode-hybrid';
      case 'SNAPSHOT':
        return 'mode-snapshot';
      default:
        return 'mode-hybrid';
    }
  };

  return (
    <div className="data-mode-indicator">
      <span className={`mode-badge ${getModeClass()}`} title="System Data Ingestion Mode">
        <Database size={12} />
        <span>Mode: {mode}</span>
      </span>
      <span className="pilot-badge" title="Active Pilot Sector">
        <ShieldCheck size={12} />
        <span>{pilotArea}</span>
      </span>
    </div>
  );
}
