import { cn } from '../../lib/cn';
import { scorePassword } from './passwordScore';

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/** 4-bar meter + hint. Give the password input aria-describedby={hintId}. */
export function PasswordStrength({ password, hintId }: { password: string; hintId: string }) {
  const score = scorePassword(password);
  const hint = password ? `${LABELS[score]}. At least 8 characters.` : 'At least 8 characters.';

  return (
    <>
      <div aria-hidden="true" className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={cn('h-1 rounded-sm', bar <= score ? 'bg-accent' : 'bg-border-strong')}
          />
        ))}
      </div>
      <p id={hintId} className="text-xs text-muted">
        {hint}
      </p>
    </>
  );
}
