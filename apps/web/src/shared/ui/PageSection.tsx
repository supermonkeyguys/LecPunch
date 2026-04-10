import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface PageSectionProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export const PageSection = ({ children, className, padded = false }: PageSectionProps) => {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm',
        padded && 'p-6',
        className
      )}
    >
      {children}
    </section>
  );
};
