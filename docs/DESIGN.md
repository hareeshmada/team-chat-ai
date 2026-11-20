# TeamChat AI – Design spec

Direction: **Night**, developer feel, dark by default with a light theme.
This file is the single source of truth for UI. Read it before building or changing any screen.

- Visual references: `docs/design/screens/*.html` (open in a browser; read the source for exact values).
- Screen tracker: the table at the end of this file.
- If code and this file disagree, ask before changing either. Record every agreed change here.

---

## 1. Principles

1. **Dense, calm, technical.** Compact rows, thin borders, no heavy shadows or gradients.
2. **Two fonts with clear jobs.** Inter for reading (messages, headings, buttons). JetBrains Mono for machine-ish things: timestamps, channel names, form labels, status, code, counts.
3. **One accent.** Lime is for primary actions, focus, the active item, the AI and "live" states. Never decorate with it.
4. **Show the real-time system.** Connection status, streaming indicators and live states are part of the design, not hidden.
5. **Semantic tokens only.** Components use token classes (`bg-surface`, `text-muted`), never raw hex values, so both themes work automatically.

## 2. Themes

- `dark` is the default. `light` is opt-in via the theme toggle (user menu and auth screens).
- The theme is set as `data-theme="dark|light"` on `<html>` and saved in `localStorage` key `tc-theme`.
- Apply the saved theme with a tiny inline script in `index.html` before the app loads, so there is no flash of the wrong theme.

## 3. Color tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#0B0D10` | `#F7F8FA` | App background |
| `surface` | `#111418` | `#FFFFFF` | Sidebar, cards, forms, status bar |
| `surface-2` | `#1A1E25` | `#EEF0F3` | Hover, active item, inline code, auth side panel (light) |
| `panel` | `#0E1115` | `#F2F4F7` | AI assistant panel |
| `field` | `#0B0D10` | `#FFFFFF` | Input background (= `bg` dark, `surface` light) |
| `border` | `#22262E` | `#E1E4E8` | Dividers, card borders |
| `border-strong` | `#2E3440` | `#CDD2D9` | Inputs, secondary buttons, tags |
| `fg` | `#E6E8EB` | `#111418` | Primary text |
| `muted` | `#9BA3AF` | `#5B6470` | Secondary text, labels, timestamps |
| `subtle` | `#6B7280` | `#8A929C` | Disabled and decorative only (fails contrast for body text) |
| `accent` | `#A3E635` | `#65A30D` | Fills: primary button, active marker, progress, cursor |
| `accent-hover` | `#BEF264` | `#4D7C0F` | Hover on accent fills |
| `on-accent` | `#0B0D10` | `#0B0D10` | Text/icons on accent fills |
| `accent-fg` | `#A3E635` | `#4D7C0F` | Accent used as text: links, bot name, `$` prompt |
| `danger` | `#F87171` | `#DC2626` | Errors, destructive actions |
| `on-danger` | `#0B0D10` | `#FFFFFF` | Text on danger fills |
| `focus-ring` | accent 15% | accent 18% | Focus ring color (`ring-focus-ring`) |
| `success` | `#4ADE80` | `#16A34A` | Online, connected, completed |
| `warning` | `#FCD34D` | `#B45309` | Connecting, SSE tag, limits near |
| `info` | `#93C5FD` | `#1D4ED8` | WebSocket tag, links in event feed |
| `skeleton` | `#1A1E25` | `#E5E8EC` | Loading placeholders (titles, names) |
| `skeleton-2` | `#15181D` | `#EEF0F3` | Secondary skeleton bars (body lines) |
| `brand-panel` | `#111418` | `#EEF0F3` | Auth brand panel background (= `surface` dark, `surface-2` light) |
| `brand-dot` | `#22262E` | `#D5DAE0` | Dots of the brand panel's 24px grid (`bg-dot-grid` utility) |
| `shadow-float` | `0 12px 40px rgba(0,0,0,.5)` | `0 8px 24px rgba(17,20,24,.12)` | Floating layers only (§6); CSS var `--float-shadow`, class `shadow-float` |

**Author colors** (usernames in messages, assigned by a stable hash of the user id):

| | Dark | Light |
|---|---|---|
| `author-1` | `#FCD34D` | `#B45309` |
| `author-2` | `#93C5FD` | `#1D4ED8` |
| `author-3` | `#86EFAC` | `#15803D` |
| `author-4` | `#C4B5FD` | `#6D28D9` |
| `author-5` | `#F9A8D4` | `#BE185D` |

Focus ring: `0 0 0 3px` accent at 15% opacity (dark) / 18% (light), plus a 1px `accent` border. In code: `ring-[3px] ring-focus-ring border-accent`.

**Why `field` / `on-danger` / `focus-ring` are tokens:** values that differ per theme must be tokens, not `dark:` overrides. The `dark:` variant matches anything *inside* `[data-theme="dark"]`, so it breaks for a light subtree nested in a dark page (e.g. the `/dev/ui` side-by-side preview).

## 4. Tailwind 4 setup (`apps/client/src/index.css`)

```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root,
[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0B0D10; --surface: #111418; --surface-2: #1A1E25; --panel: #0E1115; --field: #0B0D10;
  --border: #22262E; --border-strong: #2E3440;
  --fg: #E6E8EB; --muted: #9BA3AF; --subtle: #6B7280;
  --accent: #A3E635; --accent-hover: #BEF264; --on-accent: #0B0D10; --accent-fg: #A3E635;
  --focus-ring: color-mix(in srgb, var(--accent) 15%, transparent);
  --danger: #F87171; --on-danger: #0B0D10; --success: #4ADE80; --warning: #FCD34D; --info: #93C5FD;
  --skeleton: #1A1E25;
  --skeleton-2: #15181D;
  --brand-panel: #111418;
  --brand-dot: #22262E;
  --float-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  --author-1: #FCD34D; --author-2: #93C5FD; --author-3: #86EFAC; --author-4: #C4B5FD; --author-5: #F9A8D4;
}

[data-theme="light"] {
  color-scheme: light;
  --bg: #F7F8FA; --surface: #FFFFFF; --surface-2: #EEF0F3; --panel: #F2F4F7; --field: #FFFFFF;
  --border: #E1E4E8; --border-strong: #CDD2D9;
  --fg: #111418; --muted: #5B6470; --subtle: #8A929C;
  --accent: #65A30D; --accent-hover: #4D7C0F; --on-accent: #0B0D10; --accent-fg: #4D7C0F;
  --focus-ring: color-mix(in srgb, var(--accent) 18%, transparent);
  --danger: #DC2626; --on-danger: #FFFFFF; --success: #16A34A; --warning: #B45309; --info: #1D4ED8;
  --skeleton: #E5E8EC;
  --skeleton-2: #EEF0F3;
  --brand-panel: #EEF0F3;
  --brand-dot: #D5DAE0;
  --float-shadow: 0 8px 24px rgba(17, 20, 24, 0.12);
  --author-1: #B45309; --author-2: #1D4ED8; --author-3: #15803D; --author-4: #6D28D9; --author-5: #BE185D;
}

@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-panel: var(--panel); --color-field: var(--field); --color-border: var(--border); --color-border-strong: var(--border-strong);
  --color-fg: var(--fg); --color-muted: var(--muted); --color-subtle: var(--subtle);
  --color-accent: var(--accent); --color-accent-hover: var(--accent-hover);
  --color-on-accent: var(--on-accent); --color-accent-fg: var(--accent-fg); --color-focus-ring: var(--focus-ring);
  --color-danger: var(--danger); --color-on-danger: var(--on-danger); --color-success: var(--success);
  --color-warning: var(--warning); --color-info: var(--info); --color-skeleton: var(--skeleton);
  --color-skeleton-2: var(--skeleton-2); --color-brand-panel: var(--brand-panel);
  --color-brand-dot: var(--brand-dot); --shadow-float: var(--float-shadow);
  --color-author-1: var(--author-1); --color-author-2: var(--author-2); --color-author-3: var(--author-3);
  --color-author-4: var(--author-4); --color-author-5: var(--author-5);
  --font-sans: "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

body { @apply bg-bg text-fg font-sans text-sm antialiased; }

/* Plus two utilities: bg-dot-grid (radial-gradient of --brand-dot, 24px) and
   animate-blink (terminal cursor; off under prefers-reduced-motion). */
```

Load fonts with `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` (self-hosted, no layout shift), imported once in `main.tsx`. These packages register the families as **"Inter Variable"** and **"JetBrains Mono Variable"**, so those names must come first in `--font-sans` / `--font-mono` (plain "Inter" would silently fall back to the system font).

## 5. Typography

| Role | Font | Size / line-height | Weight |
|---|---|---|---|
| Display (auth headline) | Inter | 34 / 1.15, tracking -0.02em | 700 |
| Page title (form h1) | Inter | 22 / 1.3 | 600 |
| Section title (panel h2) | Mono | 13 / 1.4 | 600 |
| Channel title | Mono | 15 / 1.4 | 600 |
| Body / messages | Inter | 14 / 1.5 | 400 |
| Small body | Inter | 13 / 1.5 | 400 |
| Form label | Mono, lowercase | 12 / 1.4 | 400, `muted` |
| Meta (time, counts, status) | Mono | 11–12 / 1.4 | 400, `muted` |
| Group label (sidebar) | Inter, uppercase, tracking 0.08em | 11 | 600, `muted` |
| Code | Mono | 12–13 | 400 |

Copy style: headings and buttons in sentence case ("Create account"); labels, meta and status in lowercase mono ("email", "ws connected · 38 ms").

## 6. Spacing, radius, elevation

- Spacing scale: 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 48, 56 px (Tailwind defaults cover these).
- Radius: `4px` tags/badges/kbd · `6px` buttons, inputs, nav items · `8px` composer · `10px` cards, forms, popovers · `full` dots.
- Elevation: borders, not shadows. Only floating layers (popovers, modals, toasts, the loading card) get `0 12px 40px rgba(0,0,0,0.5)` dark / `0 8px 24px rgba(17,20,24,0.12)` light.

## 7. Layout

- **App shell:** sidebar `232px` · main (flex 1) · AI panel `340px` (toggleable) · status bar `28px` at the bottom.
- Header height ~56px with a 1px bottom border.
- Message rows: grid `52px` time column + content; row padding `6px 8px`; gap between rows `4px`.
- **Auth screens:** split layout. Brand panel (flex 1 1 520px, `surface` with a 24px dot grid) + form column (form max-width 400px, centered). Below ~1000px the brand panel stacks on top; below 640px hide the brand panel's middle block.
- Breakpoints: `< 768px` sidebar and AI panel become slide-over drawers; `768–1279px` AI panel closed by default; `≥ 1280px` full shell.

## 8. Components

Build these once in `apps/client/src/components/ui/` and reuse them. Icons: `lucide-react`, 16px (14px in dense spots), stroke 2, `currentColor`.

- **Button** – `primary`: `bg-accent text-on-accent`, 44px tall in forms / 32–36px in toolbars, 6px radius, weight 600. `secondary`: transparent, `border-border-strong`, `text-fg`. `ghost`: no border, `text-muted`, hover `bg-surface-2`. `danger`: `bg-danger text-on-danger` (white in light, dark in dark). Optional trailing `↵` hint on submit buttons. Icon-only buttons need `aria-label`, min 32px.
- **Input** – 42px tall, `bg-field`, `border-border-strong`, 6px radius; mono for email/password/code, Inter for names and free text. States: focus (accent border + ring), error (`border-danger` + message below in `danger`, linked with `aria-describedby`), disabled (`text-subtle`).
- **Label** – lowercase mono, 12px, `muted`, always a real `<label for>`.
- **TerminalCard** – card with a 34px mono header strip (`$ teamchat login`), border-bottom, 24px body padding. Used for auth forms and the "live events" panel.
- **Tag** – mono 12px, `text-fg`, `border-border-strong`, 4px radius, `3px 8px` padding.
- **Badge** – mono 10px uppercase on `bg-accent text-on-accent` ("BOT"), 3px radius.
- **StatusDot** – 6–7px circle: `success` online/connected, `warning` connecting, hollow `subtle` ring offline, `accent` live (the "connected" live-events feed, AI streaming). Decorative (`aria-hidden`): always paired with text.
- **Sidebar item** – 30px tall, mono 13px for channels (`#frontend`), Inter for people; active = `bg-surface-2` + 2px inset left marker in `accent`; unread = `fg` + weight 600 + accent count.
- **Message row** – time (mono, muted) · author (Inter 600, author color) · body. Highlighted/own new message: `bg-surface`. Reactions as tags. Bot author in `accent-fg` + BOT badge. Inline code: mono on `surface-2`. Code blocks: mono 12px on `bg`, bordered, horizontal scroll.
- **Composer** – 8px radius container, `surface`, `border-border-strong`; leading `›` prompt in accent; mono placeholder; attach (ghost icon) and primary "Send ↵".
- **AI panel** – `panel` background; mono header "assistant" + live "streaming · N tok/s" indicator; blinking block cursor (7×15px accent) while streaming; "stop  esc" secondary button; usage meter as 20 segmented blocks.
- **Status bar** – 28px, `surface`, mono 11px muted: `● ws connected · 38 ms`, `sse notifications · live`, user on the right.
- **Skeleton** – `skeleton` bars with 3px radius; respect `prefers-reduced-motion` (no shimmer when set).
- **Loading card** – centered floating card over a skeleton app shell with checklist steps (✓ done in `success`, › current in `accent`, · pending in `subtle`) and a 3px progress bar.
- **Theme toggle** – icon button (moon in light, sun in dark), `aria-label="Switch to dark theme"` / light.

### Built components (`apps/client/src/components/ui/`)

Preview every component in both themes at **`/dev/ui`** (dev server only; not in production builds).

| Component | Props (beyond native ones) |
|---|---|
| `Button` | `variant` primary/secondary/ghost/danger · `size` md (44px) / sm (32px) / icon (36px, `aria-label` required by TypeScript) · `enterHint` adds `↵` · `type` defaults to `button` |
| `Input` | `id` (required) · `error` (text or ReactNode, e.g. with a link; red border + message linked via `aria-describedby`, `aria-invalid`) · `mono` (default for email/password) · `ref` works with react-hook-form |
| `Label` | `htmlFor` (required) |
| `TerminalCard` | `title` · `prompt` (accent `$`) · `actions` (header right) · `padding` md (24px) / sm (14px) · `tone` surface (forms) / field (a card on a surface, e.g. the brand-panel feed) |
| `Tag` | – |
| `StatusDot` | `status` online/connecting/offline/live |
| `ThemeToggle` | – (uses `useTheme()` from `src/lib/theme.ts`) |
| `Logo` | `size` md (32px) / sm (28px) · `wordmark` adds "teamchat-ai" |
| `Badge` | – (e.g. `<Badge>bot</Badge>`) |
| `Divider` | `label` (e.g. "or"; without it a plain rule) |
| `Skeleton` | `tone` primary (`skeleton`) / secondary (`skeleton-2`) · size via `className` · always `aria-hidden` |
| `FormError` | – form-level error box with `role="alert"` (e.g. "Invalid email or password") |

Auth-only pieces live in `src/features/auth/`: `AuthLayout` (split layout + theme toggle), `BrandShowcase` (live-events feed / "what you get"), `PasswordStrength` (4 bars + hint), `LoadingScreen`, and `SoonTag` for visible-but-not-built controls ("forgot?", "Continue with Google").

`className` on these components is for layout (margin, width), not for overriding variant styles (no tailwind-merge).

## 9. Accessibility

- Text contrast ≥ 4.5:1 (all `fg`/`muted` pairs above pass on `bg`, `surface` and `panel`). `subtle` is never used for readable text.
- Every input has a `<label>`; errors use `aria-describedby`; loading uses `role="status"` / `aria-busy`.
- Touch targets ≥ 32px on desktop toolbars, ≥ 44px on mobile.
- Never rely on color alone: errors also have text, unread also has weight + count.
- Respect `prefers-reduced-motion` for the cursor blink, typing dots and skeleton shimmer.

## 10. Screen tracker

Status: `planned` → `designed` → `built`. Update this table when a screen changes state. New requirement? Add a row as `planned` first.

| Day | Screen / state | Status | Reference |
|---|---|---|---|
| 1 | Login (dark) | built | `screens/login-dark.html` |
| 1 | Login (light) | built | `screens/login-light.html` |
| 1 | Register (dark; light follows tokens) | built | `screens/register-dark.html` |
| 1 | Session restore / loading | built | `screens/loading-dark.html` |
| 2 | App shell + channel view + AI panel | designed | `screens/chat-dark.html` |
| 2 | App shell (light) | planned | – |
| 2 | Create first workspace (onboarding) | planned | – |
| 2 | Workspace switcher dropdown | planned | – |
| 2 | Create channel modal | planned | – |
| 2 | Invite member modal | planned | – |
| 2 | Empty channel state | planned | – |
| 2 | Message states: sending / failed-retry; reconnecting banner | planned | – |
| 2 | Mobile layout (drawers) | planned | – |
| 3 | Message hover actions, edit mode, deleted placeholder | planned | – |
| 3 | @mention autocomplete | planned | – |
| 3 | Notifications dropdown + mention toast | planned | – |
| 4 | AI panel: history list, error + retry, markdown/code | planned | – |
| 4 | Summarize modal | planned | – |
| 4 | AI usage limit reached | planned | – |
| 4 | User menu (usage, theme toggle, log out) | planned | – |
| 5 | Composer upload: drag overlay, progress, chips | planned | – |
| 5 | Attachments: image thumbnail, PDF card | planned | – |
| 5 | Link preview card | planned | – |
| 5 | Channel settings menu (export CSV) | planned | – |

## 11. Change log

- 2026-11-20 – Night direction chosen; dark default + light theme; Day 1 screens designed.
- 2026-11-20 – Step 1.2b: added tokens `field`, `on-danger`, `focus-ring`; font families use the `@fontsource-variable` names; Tag text is `fg` (reference used non-token `#C9D1D9`); StatusDot gets a `live` (accent) variant; base components built.
- 2026-11-20 – Step 1.3: Login, Register and Loading built. Added tokens `skeleton-2` (was a hex note under `skeleton`), `brand-panel`, `brand-dot`, `shadow-float` (values from the references and §6); components Logo, Badge, Divider, Skeleton, FormError; TerminalCard `tone`; Input `error` accepts a ReactNode. "forgot?" and "Continue with Google" are shown disabled with a `soon` tag until PLAN Step 7.5. Tags keep `text-fg` in light (reference used non-token `#3A424D` on white).
