import * as RadixProgress from '@radix-ui/react-progress';
import { cn } from '../lib/cn';

interface ProgressProps {
  value: number; // 0–100
  variant?: 'default' | 'warning' | 'danger';
  className?: string;
}

const trackColor = 'bg-gray-100';

const fillColor: Record<string, string> = {
  default: 'bg-blue-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
};

export function Progress({ value, variant = 'default', className }: ProgressProps) {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <RadixProgress.Root
      value={clamped}
      max={100}
      className={cn('w-full h-2 rounded-full overflow-hidden', trackColor, className)}
    >
      <RadixProgress.Indicator
        className={cn('h-full transition-all duration-500', fillColor[variant])}
        style={{ width: `${clamped}%` }}
      />
    </RadixProgress.Root>
  );
}
