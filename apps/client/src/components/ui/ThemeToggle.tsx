import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { Button } from './Button';

/** Shows the theme you'd switch TO: a sun in dark mode, a moon in light mode. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      onClick={toggleTheme}
      className={className}
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </Button>
  );
}
