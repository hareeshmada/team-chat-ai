import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type CheckboxCardProps = Omit<ComponentProps<'input'>, 'type'> & {
  title: ReactNode;
  description?: ReactNode;
};

/** A checkbox with a title and help text in a bordered, fully clickable card ("Make private"). */
export function CheckboxCard({ title, description, className, ...props }: CheckboxCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-surface-2',
        'has-focus-visible:ring-[3px] has-focus-visible:ring-focus-ring',
        className,
      )}
    >
      <input type="checkbox" {...props} className="mt-0.5 size-[18px] shrink-0 accent-accent" />
      <span className="flex flex-col">
        <span className="font-medium">{title}</span>
        {description && <span className="text-[13px] text-muted">{description}</span>}
      </span>
    </label>
  );
}
