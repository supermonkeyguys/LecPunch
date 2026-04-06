import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  prefix?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Select({ value, onValueChange, options, placeholder, prefix, className, disabled }: SelectProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        className={cn(
          'flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 text-sm font-medium text-gray-700 h-[38px]',
          'shadow-sm hover:border-blue-400 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          'data-[placeholder]:text-gray-400',
          className
        )}
        aria-label={placeholder ?? '选择'}
      >
        {prefix ? <span className="shrink-0 text-blue-600">{prefix}</span> : null}
        <RadixSelect.Value placeholder={placeholder}>
          {selected?.label}
        </RadixSelect.Value>
        <RadixSelect.Icon className="ml-1 shrink-0 text-gray-400">
          <ChevronDown className="w-4 h-4" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          style={{ width: 'var(--radix-select-trigger-width)' }}
          className={cn(
            'z-50 overflow-hidden',
            'bg-white rounded-xl border border-gray-200 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2'
          )}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'relative flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer select-none',
                  'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                  'focus:outline-none focus:bg-blue-50 focus:text-blue-700',
                  'data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700',
                  'data-[state=checked]:font-medium'
                )}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <Check className="w-3.5 h-3.5 text-blue-600" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
