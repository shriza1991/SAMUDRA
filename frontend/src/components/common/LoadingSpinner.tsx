import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
  className?: string;
}

export default function LoadingSpinner({
  message = 'Processing request...',
  size = 20,
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn('loading-spinner-container flex items-center justify-center gap-2 p-4 text-muted-foreground', className)}
      role="status"
    >
      <Loader2 size={size} className="spinner-icon animate-spin text-primary" />
      {message && <span className="spinner-message text-sm font-medium">{message}</span>}
    </div>
  );
}
