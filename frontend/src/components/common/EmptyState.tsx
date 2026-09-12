import type React from 'react';
import { HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('empty-state-view border-dashed bg-card/50 text-center', className)}>
      <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8">
        <div className="empty-state-icon mb-3 text-muted-foreground">
          {icon || <HelpCircle size={32} />}
        </div>
        <h3 className="empty-state-title text-base font-semibold text-foreground">{title}</h3>
        <p className="empty-state-desc mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
