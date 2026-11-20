import type { ReactNode } from 'react';
import { Logo } from '../../components/ui/Logo';
import { Tag } from '../../components/ui/Tag';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

export interface AuthLayoutProps {
  /** Big brand-panel headline (h2). */
  headline: string;
  /** Middle block of the brand panel; hidden below 640px. */
  showcase: ReactNode;
  /** The form card and the footer link. */
  children: ReactNode;
}

/**
 * Split auth layout (DESIGN §7): brand panel (flex 1 1 520px) + form column (flex 1 1 480px).
 * flex-wrap stacks the brand panel on top once the two bases no longer fit (~1000px).
 */
export function AuthLayout({ headline, showcase, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <section
        aria-label="About TeamChat AI"
        className="flex flex-[1_1_520px] flex-col justify-between gap-10 border-b border-border bg-brand-panel bg-dot-grid px-6 py-8 sm:px-14 sm:py-12 min-[1000px]:border-r min-[1000px]:border-b-0"
      >
        <Logo wordmark />
        <div className="max-w-[520px] max-sm:hidden">{showcase}</div>
        <div className="flex flex-col gap-[18px]">
          <h2 className="max-w-[480px] text-[34px] leading-[1.15] font-bold tracking-[-0.02em]">
            {headline}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Tag>websockets</Tag>
            <Tag>server-sent events</Tag>
            <Tag>ai streaming</Tag>
          </div>
        </div>
      </section>

      <main className="flex flex-[1_1_480px] flex-col px-6 pt-6 pb-12">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center pt-6">
          <div className="flex w-full max-w-[400px] flex-col gap-5">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Small "soon" marker for UI that is visible but not built yet. */
export function SoonTag() {
  return (
    <span className="rounded-sm border border-border-strong px-1.5 font-mono text-[10px] text-muted">
      soon
    </span>
  );
}
