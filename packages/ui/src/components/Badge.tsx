import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  {
    variants: {
      variant: {
        success: 'bg-green-100 text-green-800',
        danger:  'bg-red-100 text-red-800',
        info:    'bg-blue-100 text-blue-800',
        warning: 'bg-amber-100 text-amber-800',
        purple:  'bg-purple-100 text-purple-700',
        gray:    'bg-gray-100 text-gray-600',
      },
    },
    defaultVariants: {
      variant: 'gray',
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}
