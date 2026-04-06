import * as RadixLabel from '@radix-ui/react-label';
import { cn } from '../lib/cn';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
}

export function Input({ label, error, prefix, id, className, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <RadixLabel.Root
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </RadixLabel.Root>
      ) : null}
      <div className="relative">
        {prefix ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {prefix}
          </div>
        ) : null}
        <input
          id={inputId}
          {...props}
          className={cn(
            'w-full rounded-lg border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 transition-all',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent',
            error ? 'border-red-400 bg-red-50' : 'border-gray-200',
            prefix ? 'pl-9' : '',
            className
          )}
        />
      </div>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
