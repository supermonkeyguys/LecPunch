import * as RadixAvatar from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const avatarVariants = cva('relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0', {
  variants: {
    size: {
      sm: 'w-7 h-7 text-xs',
      md: 'w-9 h-9 text-sm',
      lg: 'w-11 h-11 text-base',
    },
  },
  defaultVariants: { size: 'md' },
});

// Deterministic background color from name string
const COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function colorFromName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface AvatarProps extends VariantProps<typeof avatarVariants> {
  src?: string;
  name: string;
  className?: string;
  avatarBase64?: string;
  avatarEmoji?: string;
  avatarColor?: string;
}

export function Avatar({
  src,
  name,
  size,
  className,
  avatarBase64,
  avatarEmoji,
  avatarColor,
}: AvatarProps) {
  const fallbackLetter = name?.[0]?.toUpperCase() ?? '?';

  // Priority 1: image (uploaded base64 or src)
  const imgSrc = avatarBase64 || src;
  if (imgSrc) {
    return (
      <div className={cn(avatarVariants({ size }), className)}>
        <img src={imgSrc} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  // Priority 2: emoji
  if (avatarEmoji) {
    return (
      <div className={cn(avatarVariants({ size }), 'bg-gray-100 flex items-center justify-center', className)}>
        <span
          className="leading-none select-none"
          style={{ fontSize: size === 'sm' ? 14 : size === 'lg' ? 22 : 18 }}
        >
          {avatarEmoji}
        </span>
      </div>
    );
  }

  // Priority 3: custom color (hex) — show initial with tinted background
  if (avatarColor) {
    return (
      <RadixAvatar.Root className={cn(avatarVariants({ size }), className)}>
        <RadixAvatar.Fallback
          className="flex h-full w-full items-center justify-center font-bold"
          style={{ backgroundColor: avatarColor + '33', color: avatarColor }}
          delayMs={0}
        >
          {fallbackLetter}
        </RadixAvatar.Fallback>
      </RadixAvatar.Root>
    );
  }

  // Priority 4: default — deterministic color from name
  const colorClass = colorFromName(name);
  return (
    <RadixAvatar.Root className={cn(avatarVariants({ size }), className)}>
      <RadixAvatar.Fallback
        className={cn('flex h-full w-full items-center justify-center font-bold', colorClass)}
        delayMs={0}
      >
        {fallbackLetter}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}
