import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const alertVariants = cva(
  'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        error:   'bg-red-50 border-red-100 text-red-700',
        warning: 'bg-amber-50 border-amber-100 text-amber-700',
        info:    'bg-blue-50 border-blue-100 text-blue-700',
        success: 'bg-green-50 border-green-100 text-green-700',
      },
    },
    defaultVariants: { variant: 'error' },
  }
);

interface AlertProps extends VariantProps<typeof alertVariants> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Alert({ variant, children, icon, onClose, className }: AlertProps) {
  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert">
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {onClose ? (
        <button
          onClick={onClose}
          aria-label="关闭"
          className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
