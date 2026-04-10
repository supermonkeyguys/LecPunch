import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

type PageStateTone = 'loading' | 'error' | 'empty';

interface PageStateProps {
  tone: PageStateTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const toneStyles: Record<PageStateTone, { icon: LucideIcon; iconClassName: string }> = {
  loading: {
    icon: Loader2,
    iconClassName: 'text-blue-600 animate-spin'
  },
  error: {
    icon: AlertTriangle,
    iconClassName: 'text-red-500'
  },
  empty: {
    icon: Inbox,
    iconClassName: 'text-gray-400'
  }
};

export const PageState = ({ tone, title, description, action, className }: PageStateProps) => {
  const Icon = toneStyles[tone].icon;

  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <div className="mb-4 rounded-full bg-gray-50 p-3">
        <Icon className={cn('h-6 w-6', toneStyles[tone].iconClassName)} />
      </div>
      <p className="text-base font-semibold text-gray-900">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
};
