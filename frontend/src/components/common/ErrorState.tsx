import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({
  title = 'Service Interruption',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className={cn('error-state-card flex flex-col gap-2 p-4', className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" />
        <div className="flex-1 space-y-1">
          <AlertTitle className="text-sm font-semibold">{title}</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
            {message}
          </AlertDescription>
        </div>
      </div>
      {onRetry && (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="error-retry-btn h-7 text-xs"
          >
            <RefreshCw className="mr-1.5 size-3" />
            <span>Retry Query</span>
          </Button>
        </div>
      )}
    </Alert>
  );
}
