import { useEffect, useState } from 'react';
import { Database, ShieldCheck, WifiOff } from 'lucide-react';
import { getHealth, type HealthResponse } from '../../api/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DataModeIndicatorProps {
  initialHealth?: HealthResponse | null;
  className?: string;
}

export default function DataModeIndicator({ initialHealth, className }: DataModeIndicatorProps) {
  const [health, setHealth] = useState<HealthResponse | null>(initialHealth ?? null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getHealth()
      .then((data) => {
        if (isMounted) {
          setHealth(data);
          setIsOffline(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsOffline(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const mode = health?.data_mode?.toUpperCase() || 'UNKNOWN';

  const getModeBadgeVariant = () => {
    switch (mode) {
      case 'LIVE':
        return 'go';
      case 'HYBRID':
        return 'caution';
      case 'SNAPSHOT':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isOffline && !health) {
    return (
      <div className={cn('data-mode-indicator flex items-center gap-1.5', className)}>
        <Badge variant="destructive" className="mode-badge gap-1 text-[11px] font-normal" title="Backend service not connected">
          <WifiOff size={12} />
          <span>Offline</span>
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn('data-mode-indicator flex items-center gap-1.5', className)}>
      <Badge
        variant={getModeBadgeVariant()}
        className="mode-badge gap-1 text-[11px] font-normal"
        title="System Data Ingestion Mode"
      >
        <Database size={12} />
        <span>Mode: {mode}</span>
      </Badge>
      {health?.database && (
        <Badge
          variant={health.database === 'connected' ? 'outline' : 'secondary'}
          className={cn(
            'pilot-badge gap-1 text-[11px] font-normal',
            health.database === 'connected' ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          )}
          title={health.database === 'connected' ? 'PostgreSQL Database Connected' : 'PostgreSQL Database Offline (Operating in in-memory snapshot mode)'}
        >
          <ShieldCheck size={12} />
          <span className="hidden sm:inline">DB: {health.database === 'connected' ? 'Connected' : 'Offline'}</span>
        </Badge>
      )}
    </div>
  );
}
