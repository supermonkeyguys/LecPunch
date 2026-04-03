import { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface CardProps {
  className?: string;
  children: ReactNode;
}

export const Card = ({ className, children }: CardProps) => {
  return <div className={cn('rounded-2xl border border-gray-200 bg-white shadow-card', className)}>{children}</div>;
};
