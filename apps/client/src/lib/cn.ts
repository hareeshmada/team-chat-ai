/**
 * Joins class names, skipping falsy values: cn('a', isOn && 'b').
 * No tailwind-merge: a `className` prop is for layout (margin, width), not for overriding a variant.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
