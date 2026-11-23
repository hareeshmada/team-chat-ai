import { cn } from '../../lib/cn';
import { initials } from './initials';

export interface AvatarProps {
  name: string;
  /** md = 28px (sidebar), sm = 24px (menus), lg = 32px (mobile drawer footer). */
  size?: 'sm' | 'md' | 'lg';
  /** accent = current workspace; neutral = other workspaces; user = a person (pass a text color). */
  tone?: 'accent' | 'neutral' | 'user';
  className?: string;
}

const sizes = {
  sm: 'size-6 rounded-[5px] text-[11px]',
  md: 'size-7 rounded-md text-xs',
  lg: 'size-8 rounded-md text-xs',
};
const tones = {
  accent: 'bg-accent text-on-accent',
  neutral: 'bg-border-strong text-fg',
  user: 'bg-surface-2',
};

/** Initials in a rounded square. Decorative: the name is always shown next to it. */
export function Avatar({ name, size = 'md', tone = 'neutral', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-mono font-semibold',
        sizes[size],
        tones[tone],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
