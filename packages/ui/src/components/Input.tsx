import { useId } from 'react';
import * as RadixLabel from '@radix-ui/react-label';
import { cn } from '../lib/cn';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  description?: string;
  prefix?: React.ReactNode;
}

export function Input({ label, error, description, prefix, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const fallbackId = `input-${generatedId.replace(/:/g, '')}`;
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-') ?? fallbackId;
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-description`;
  const describedBy = [
    props['aria-describedby'],
    description ? descriptionId : null,
    error ? errorId : null
  ]
    .filter(Boolean)
    .join(' ') || undefined;

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
          aria-describedby={describedBy}
          aria-invalid={error ? true : props['aria-invalid']}
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
      {description ? <p id={descriptionId} className="text-xs text-gray-500">{description}</p> : null}
      {error ? (
        <p id={errorId} className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
