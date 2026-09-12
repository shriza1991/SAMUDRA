import type { AgentTraceItem } from '../../types/contracts';
import { CheckCircle, XCircle, Loader, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AgentTimelineProps {
  trace: AgentTraceItem[];
  className?: string;
}

export default function AgentTimeline({ trace, className }: AgentTimelineProps) {
  if (!trace.length) return null;

  return (
    <div className={cn('agent-timeline space-y-3', className)} role="list" aria-label="Agent activity timeline">
      <h4 className="timeline-title text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Agent Reasoning Trail
      </h4>
      <div className="relative space-y-2 pl-2">
        {trace.map((item, i) => (
          <TraceStep key={i} item={item} isLast={i === trace.length - 1} />
        ))}
      </div>
    </div>
  );
}

function TraceStep({ item, isLast }: { item: AgentTraceItem; isLast: boolean }) {
  const normStatus = (item.status || '').toLowerCase();
  const isSuccess = normStatus === 'completed' || normStatus === 'ok' || normStatus === 'success';
  const isError = normStatus === 'failed' || normStatus === 'error';
  const StatusIcon = isSuccess ? CheckCircle : isError ? XCircle : Loader;

  return (
    <div className={cn('trace-step relative flex items-start gap-3 text-xs', item.status)} role="listitem">
      <div className="trace-step-connector flex flex-col items-center">
        <div
          className={cn(
            'trace-step-dot flex size-5 shrink-0 items-center justify-center rounded-full',
            isSuccess ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : isError ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary animate-spin'
          )}
        >
          <StatusIcon size={12} />
        </div>
        {!isLast && <div className="trace-step-line my-1 w-px flex-1 bg-border" />}
      </div>
      <div className="trace-step-content flex-1 rounded-lg border border-border/60 bg-card/60 p-2.5 space-y-1 mb-2">
        <div className="trace-step-header flex items-center justify-between gap-2">
          <span className="trace-node-name flex items-center gap-1.5 font-semibold text-foreground">
            <Bot size={12} className="text-primary" />
            {formatNodeName(item.node)}
          </span>
          <Badge variant="outline" className="trace-step-number h-4 px-1 text-[10px] font-bold">
            Step {item.step}
          </Badge>
        </div>
        <p className="trace-step-action text-xs text-muted-foreground leading-relaxed">{item.action}</p>
        <span className="trace-step-time block text-[10px] text-muted-foreground/80">{formatTraceTime(item.timestamp)}</span>
      </div>
    </div>
  );
}

function formatNodeName(node: string): string {
  return node.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTraceTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}
