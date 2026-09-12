import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
  className?: string;
}

export default function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('theme-toggle-btn gap-1.5 px-2 text-xs font-medium', className)}
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
      <span className="theme-label hidden sm:inline">{theme === 'light' ? 'Dark' : 'Light'}</span>
    </Button>
  );
}
