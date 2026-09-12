import type React from 'react';
import { Activity, AlertTriangle, CheckCircle2, FileCheck2, RadioTower, ShieldAlert } from 'lucide-react';
import type { ChatResponse } from '../../types/contracts';
import type { MissionContext, OperationalRole } from '../../types/mission';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OperationalSnapshotProps {
  role: OperationalRole;
  context: MissionContext;
  response: ChatResponse | null;
  onOpenEvidence: () => void;
  className?: string;
}

export default function OperationalSnapshot({
  role,
  context,
  response,
  onOpenEvidence,
  className,
}: OperationalSnapshotProps) {
  const status = response?.recommendation.status ?? 'READY';
  const evidenceCount = response?.evidence.length ?? 0;
  const traceCount = response?.trace.length ?? 0;
  const warningCount = response?.warnings.length ?? 0;

  const getStatusBadgeVariant = (st: string): 'go' | 'caution' | 'noGo' | 'unknown' | 'secondary' => {
    const s = st.toUpperCase();
    if (s.includes('GO') && !s.includes('NO')) return 'go';
    if (s.includes('CAUTION')) return 'caution';
    if (s.includes('NO')) return 'noGo';
    if (s.includes('UNKNOWN')) return 'unknown';
    return 'secondary';
  };

  if (role === 'fisher') {
    return (
      <Card className={cn('operational-snapshot fisher-snapshot border-border/80 bg-card/70 p-3 shadow-xs', className)} aria-label="Voyage brief">
        <CardContent className="p-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="snapshot-icon flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RadioTower size={16} />
            </div>
            <div className="space-y-0.5">
              <span className="snapshot-eyebrow block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Voyage brief
              </span>
              <strong className="block text-xs font-bold text-foreground">
                {context.origin_harbor} · {formatCraft(context.craft_profile)}
              </strong>
              <p className="text-[11px] text-muted-foreground">
                {response ? `Latest advisory: ${status.replace('_', '-')}.` : 'Set your context, then ask SAMUDRA before leaving port.'}
              </p>
            </div>
          </div>
          {response && evidenceCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenEvidence}
              className="snapshot-action h-7 gap-1.5 text-xs font-semibold"
            >
              <FileCheck2 size={13} className="text-primary" />
              <span>Evidence</span>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('operational-snapshot authority-snapshot border-border/80 bg-card/70 p-3.5 shadow-xs', className)} aria-label="Operational monitoring summary">
      <CardContent className="p-0 space-y-3">
        <div className="authority-snapshot-heading flex items-center justify-between">
          <div>
            <span className="snapshot-eyebrow text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Authority operational view
            </span>
            <strong className="block text-xs font-bold text-foreground">Decision audit summary</strong>
          </div>
          <Badge variant={getStatusBadgeVariant(status)} className="authority-status gap-1 text-xs font-bold">
            {status === 'READY' ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
            <span>{status.replace('_', '-')}</span>
          </Badge>
        </div>

        <div className="authority-metrics grid grid-cols-3 gap-2">
          <Metric icon={<FileCheck2 size={13} className="text-primary" />} label="Evidence" value={evidenceCount} />
          <Metric icon={<Activity size={13} className="text-primary" />} label="Trace steps" value={traceCount} />
          <Metric
            icon={<AlertTriangle size={13} className={warningCount > 0 ? 'text-amber-500' : 'text-muted-foreground'} />}
            label="Warnings"
            value={warningCount}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenEvidence}
          className="authority-audit-link w-full text-xs font-medium"
          disabled={!response}
        >
          Review evidence and execution trace
        </Button>
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="authority-metric flex flex-col items-center rounded-lg border border-border/50 bg-background/50 p-2 text-center">
      <span className="mb-0.5">{icon}</span>
      <strong className="text-sm font-bold text-foreground">{value}</strong>
      <small className="text-[10px] text-muted-foreground font-medium">{label}</small>
    </div>
  );
}

function formatCraft(profile: MissionContext['craft_profile']): string {
  if (profile === 'traditional_non_motorized') return 'Traditional craft';
  if (profile === 'mechanized_trawler') return 'Mechanized trawler';
  return 'Motorized boat';
}
