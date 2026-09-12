import type { EvidenceItem } from '../../types/contracts';
import { Clock, ExternalLink, MapPin } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EvidenceCardProps {
  evidence: EvidenceItem;
  className?: string;
}

export default function EvidenceCard({ evidence, className }: EvidenceCardProps) {
  const freshness = getFreshness(evidence);

  return (
    <Card className={cn('evidence-card border-border/80 bg-card/80 p-3 shadow-xs space-y-2.5', className)}>
      <CardHeader className="p-0 flex flex-row items-center justify-between gap-2 space-y-0">
        <span className="evidence-source-name text-xs font-bold text-foreground truncate">{evidence.source_name}</span>
        <FreshnessBadge freshness={freshness} />
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        {evidence.metric_name && (
          <div className="evidence-metric rounded-md bg-background/60 p-2 text-xs flex justify-between items-center border border-border/40">
            <span className="evidence-metric-name text-muted-foreground font-medium">{formatMetricName(evidence.metric_name)}</span>
            <span className="evidence-metric-value font-bold text-foreground">
              {formatMetricValue(evidence.metric_value)} {evidence.metric_unit}
            </span>
          </div>
        )}

        <div className="evidence-times text-[11px] text-muted-foreground space-y-1">
          {evidence.valid_from && evidence.valid_to && (
            <div className="evidence-time-row flex items-center gap-1.5">
              <Clock size={11} className="text-primary shrink-0" />
              <span>Valid: {formatTime(evidence.valid_from)} — {formatTime(evidence.valid_to)}</span>
            </div>
          )}
          {evidence.retrieved_at && (
            <div className="evidence-time-row flex items-center gap-1.5">
              <Clock size={11} className="text-muted-foreground shrink-0" />
              <span>Retrieved: {formatTime(evidence.retrieved_at)}</span>
            </div>
          )}
        </div>

        {evidence.geometry && (
          <div className="evidence-geo flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin size={11} className="text-primary shrink-0" />
            <span>{evidence.geometry.type}: [{formatCoords(evidence.geometry.coordinates)}]</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-0 pt-1 flex items-center justify-between gap-2 border-t border-border/40">
        <div className="evidence-flags flex flex-wrap gap-1">
          {evidence.quality_flags.map((flag, i) => (
            <Badge key={i} variant="outline" className={`evidence-flag flag-${flag} text-[10px] h-4 px-1.5 font-normal text-muted-foreground`}>
              {flag}
            </Badge>
          ))}
        </div>
        {evidence.source_url && (
          <a
            href={evidence.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="evidence-url inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <ExternalLink size={11} /> Source
          </a>
        )}
      </CardFooter>
    </Card>
  );
}

function FreshnessBadge({ freshness }: { freshness: string }) {
  const norm = freshness.toLowerCase();
  const isFresh = norm.includes('fresh') || norm.includes('real-time') || norm.includes('live');
  const isStale = norm.includes('stale');

  return (
    <Badge
      variant={isFresh ? 'go' : isStale ? 'noGo' : 'caution'}
      className="freshness-badge text-[10px] h-4 px-1.5 font-semibold"
    >
      {freshness}
    </Badge>
  );
}

function getFreshness(evidence: EvidenceItem): string {
  const directFlag = evidence.quality_flags?.find(f =>
    ['fresh', 'stale', 'aging', 'official_source', 'snapshot', 'simulated', 'live'].includes(f.toLowerCase())
  );
  if (directFlag) return directFlag;

  if (!evidence.retrieved_at) return 'active';
  const ageMs = Date.now() - new Date(evidence.retrieved_at).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 6) return 'fresh';
  if (hours < 24) return 'aging';
  return 'stale';
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

function formatMetricName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatMetricValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (typeof value === 'number') return value.toFixed(1);
  return String(value);
}

function formatCoords(coords: unknown): string {
  if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number') {
    return `${coords[0].toFixed(2)}, ${coords[1].toFixed(2)}`;
  }
  return JSON.stringify(coords).slice(0, 40);
}
