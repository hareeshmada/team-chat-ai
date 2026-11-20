import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export type LabelProps = ComponentProps<'label'> & { htmlFor: string };

/** Form label: lowercase mono, muted. Always tied to an input via htmlFor. */
export function Label({ className, ...props }: LabelProps) {
  return <label className={cn('font-mono text-xs text-muted lowercase', className)} {...props} />;
}
