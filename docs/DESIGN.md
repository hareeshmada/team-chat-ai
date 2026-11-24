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
| `backdrop` | `rgba(0,0,0,.6)` | `rgba(17,20,24,.45)` | Overlay behind modals and the mobile drawer (light value isn't in the references; chosen to match) |
| `accent-soft` | `rgba(163,230,53,.10)` | `rgba(101,163,13,.10)` | Your own reaction pills, mention tokens that mention you, the "you were mentioned" row tint, the notification/toast `@` icon square |
| `info-soft` | `rgba(147,197,253,.10)` | `rgba(29,78,216,.08)` | Mention tokens that mention someone else |

**Author colors** (usernames in messages, assigned by a stable hash of the user id):

| | Dark | Light |
|---|---|---|
| `author-1` | `#FCD34D` | `#B45309` |
| `author-2` | `#93C5FD` | `#1D4ED8` |
| `author-3` | `#86EFAC` | `#15803D` |
| `author-4` | `#C4B5FD` | `#6D28D9` |
| `author-5` | `#F9A8D4` | `#BE185D` |

**Tints:** tinted backgrounds use Tailwind's opacity modifier on a token: banners `bg-warning/10 border-warning/35` (same for `success`, `danger`), failed message row `bg-danger/8`. Exception: the Day 3 accent/info tints are tokens (`accent-soft`, `info-soft`) because the light values aren't simply the same opacity of the light token.

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
  --backdrop: rgba(0, 0, 0, 0.6);
  --accent-soft: rgba(163, 230, 53, 0.10); --info-soft: rgba(147, 197, 253, 0.10);
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
  --backdrop: rgba(17, 20, 24, 0.45);
  --accent-soft: rgba(101, 163, 13, 0.10); --info-soft: rgba(29, 78, 216, 0.08);
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
  --color-brand-dot: var(--brand-dot); --shadow-float: var(--float-shadow); --color-backdrop: var(--backdrop);
  --color-accent-soft: var(--accent-soft); --color-info-soft: var(--info-soft);
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
- **Sidebar item** – 32px tall (Day 3), mono 13px for channels (`#frontend`), Inter for people; active = `bg-surface-2` + 2px inset left marker in `accent`. **Unread** = name in `fg` + weight 600 + count in mono 11px `muted` (weight 400, `aria-label="12 unread"`), capped at `99+`. **Mentions** = accent badge "@n" instead of the count (mono 11px/600, `bg-accent text-on-accent`, 4px radius, `0 6px`, `aria-label="1 mention"`). Read channels: `muted`, weight 400. Reference: `screens/day3-chat-dark.html`, `screens/day3-states.html` §08.
- **Message row** – time (mono, muted) · author (Inter 600, author color) · body. Highlighted/own new message: `bg-surface`. Reactions as tags. Bot author in `accent-fg` + BOT badge. Inline code: mono on `surface-2`. Code blocks: mono 12px on `bg`, bordered, horizontal scroll.
- **Composer** – 8px radius container, `surface`, `border-border-strong`; leading `›` prompt in accent; mono placeholder; attach (ghost icon) and primary "Send ↵".
- **AI panel** – `panel` background; mono header "assistant" + live "streaming · N tok/s" indicator; blinking block cursor (7×15px accent) while streaming; "stop  esc" secondary button; usage meter as 20 segmented blocks.
- **Status bar** – 28px, `surface`, mono 11px muted: `● ws connected · 38 ms`, `sse notifications · live`, user on the right.
- **Skeleton** – `skeleton` bars with 3px radius; respect `prefers-reduced-motion` (no shimmer when set).
- **Loading card** – centered floating card over a skeleton app shell with checklist steps (✓ done in `success`, › current in `accent`, · pending in `subtle`) and a 3px progress bar.
- **Theme toggle** – icon button (moon in light, sun in dark), `aria-label="Switch to dark theme"` / light.
- **Modal** – dialog, max-width 460px, `surface`, `border-strong`, 10px radius, `shadow-float`, over a `backdrop` overlay. Header: title (Inter 16/600) + ghost close icon (32px, `aria-label="Close"`), border-bottom. Body 20px padding, 16px gap. Footer: right-aligned secondary + primary (`↵` hint), border-top. Focus is trapped inside, Esc closes, focus returns to the button that opened it. Reference: `screens/day2-modals.html`.
- **Banner** – full width under the channel header, 6px radius, `10px 14px` padding, 13px text, leading 14px icon. Tones: `warning` ("Connection lost. Reconnecting…" + spinner + mono "attempt N"), `success` ("Back online. N missed messages loaded.", hides after 3 s), `danger` ("Can't reach the server." + danger-outline "Retry now"). Background `bg-<tone>/10`, border `<tone>/35`. `role="status"` (warning/success) or `role="alert"` (danger). Reference: `screens/day2-states.html` §05.
- **Popover menu** – floating list (e.g. the workspace switcher): 280px, `surface`, `border-strong`, 10px radius, `shadow-float`, 6px padding. Mono 11px section label; items 40px (actions 36px, 13px) with 6px radius, hover/current `bg-surface-2`, check icon on the current item; `border` dividers; mono 11px footer text. Esc or click outside closes; arrow keys move between items; focus returns to the trigger. Reference: `screens/day2-states.html` §01.
- **Avatar** – initials in a rounded square (mono 600): 28px/6px radius in the sidebar header and footer, 24px/5px in menus. `accent` fill (`on-accent` text) for the current workspace, `border-strong` fill otherwise; user avatar on `surface-2` with an author color.
- **MessageRow states** – grid `52px` time + content. **sent**: normal; "sent" (mono 11px `muted`) appears only on hover. **sending**: body in `muted` + "sending…" (mono 11px). **failed**: row `bg-danger/8`, 6px radius, body keeps its text, then mono 11px `danger` "failed to send" + `retry` (26px, danger outline, 4px radius) + `discard` (ghost, `muted`). **compact**: a follow-up from the same author (within 5 min) has no author line and `2px 8px` padding. Reference: `screens/day2-states.html` §02.
- **NewMessagesPill** – accent pill (34px, `rounded-full`, `bg-accent text-on-accent`, 13px/600, `shadow-float`) with a ↓ icon: "N new messages". Floats above the composer; click scrolls to the bottom. Reference: `screens/day2-states.html` §03.
- **History edges** – "loading older messages" pill (mono 11px, `border`, rounded-full, accent spinner, `role="status"`); "start of #channel" block (mono 600 title + `muted` "Created by X on D. You've reached the first message.", border-bottom); day divider (mono 11px "today" between `border` rules).
- **Typing indicator** – mono 12px `muted` just above the composer, three 4px dots (opacity 1/.6/.3, no animation under reduced motion), `aria-live="polite"`. Reference: `screens/day2-states.html` §04.
- **MessageActionsToolbar** – `role="toolbar"` `aria-label="Message actions"`, absolutely placed at the row's top-right (`top: -16px; right: 12px`), 2px padding/gap, `surface`, `border-strong`, 6px radius, `shadow-float`. 32px icon buttons (4px radius, hover `bg-surface-2`): Add reaction (smile-plus), Edit (pencil), Delete (trash, `danger`). Shown on row hover **and** when focus is inside the row; the hovered row gets `bg-surface`. Edit and delete only on your own messages; others get react only. Not on sending/failed/deleted rows. Reference: `screens/day3-states.html` §01.
- **ReactionPicker** – `role="menu"` `aria-label="Pick a reaction"`, opens from the react button: one row of 6 emoji buttons (40px, 6px radius, 20px emoji, hover/focused `bg-surface-2`, each with an `aria-label` like "thumbs up"), 4px padding, `surface`, `border-strong`, 10px radius, `shadow-float`. Clicking toggles your reaction and closes; Esc/outside click close; ←/→ move. Reference: §02.
- **ReactionPill** – 26px, `0 8px`, 6px radius, mono 12px, emoji + count, `aria-pressed`. Not reacted: `border-border-strong`, `text-fg`, transparent. You reacted: `border-accent bg-accent-soft text-accent-fg`. Hover/focus shows a tooltip (`role="tooltip"`, inverted: `bg-fg text-bg`, 12px, 4px radius, `4px 8px`): "priya, arjun and you reacted with 👍". After the pills, a dashed 30×26 "Add reaction" button (`border-dashed border-border-strong`, `muted`). `aria-label`: "thumbs up, 3 reactions including yours". Reference: §03 and `day3-chat-dark.html`.
- **InlineEditor** – the row's body becomes a textarea in place (hidden label "Edit message"): `bg-field`, accent border + focus ring, 6px radius, `8px 10px`, no resize, grows with content. Below: mono 11px `muted` "esc cancel · ↵ save" + secondary sm "Cancel" + primary sm "Save". Shift+Enter = new line. After saving everyone sees mono 11px `muted` "(edited)" after the text. Reference: §04.
- **Deleted placeholder** – compact row (`2px 8px`): time + italic `muted` "message deleted"; no author line, no reactions, no actions. Delete asks first with a small confirm dialog (max-width 380px, 20px padding, title "Delete message?", text "Everyone in #x will see “message deleted” in its place.", secondary Cancel + `danger` Delete); **Shift+click** on delete skips the dialog. Reference: §05.
- **MentionAutocomplete** – `role="listbox"` `aria-label="Mention a member"` floating above the composer: 320px, `surface`, `border-strong`, 10px radius, `shadow-float`, 4px padding. Mono 11px `muted` header ("members matching “ar”"), options 40px (`role="option"`, `aria-selected`, selected `bg-surface-2`): StatusDot + mono 600 name + `muted` 13px secondary text; online members first. Footer mono 11px "↑↓ move · ↵ or tab select · esc close". Opens on `@`, filters as you type. Reference: §06.
- **Mention token** – inline mono 13px, 4px radius, `0 4px`: mentions **you** → `text-accent-fg bg-accent-soft`; someone else → `text-info bg-info-soft`. A message that mentions you gets a row tint `bg-accent-soft`. Reference: §07.
- **NewDivider** – `role="separator"` `aria-label="New messages"`: mono 11px `accent-fg` "new" at the right of a 1px `accent` rule (60% opacity), 8px vertical padding. Sits above the first unread message when you open a channel, and moves above the first message that arrived while you were away when you come back to the window (it stays until you leave the channel). Reference: §08.
- **NotificationsDropdown** (Step 3.3) – `role="dialog"` under the bell, max-width 400px, `surface`, `border-strong`, 10px radius, `shadow-float`. Header: mono 13/600 "notifications" + accent "· 3 new" + ghost "Mark all read". Items: grid `28px · 1fr · auto`, 10px padding, 6px radius; icon square (28px, `bg-accent-soft text-accent-fg` "@" for mentions, neutral icon for invites/system); "**meera** mentioned you in `#frontend`" + `muted` 13px excerpt; mono time + unread dot. Unread items `bg-surface-2`, read items `muted`. Footer: status dot + "stream connected" / "stream reconnecting · will replay missed · attempt N" + "Load older". Empty: icon + "You’re all caught up" + "Mentions and invites will show up here." Clicking an item jumps to the message and marks it read. Bell button: 32px secondary icon button; badge top-right (18px min, rounded-full, `bg-accent text-on-accent`, 2px `bg` border, mono 10/600), `9+` cap, `aria-label="Notifications, 3 unread"`. Reference: `screens/day3-notifications.html` §01–03.
- **Desktop notifications toggle** (Step 3.3 addition) – a strip above the dropdown footer, 13px `muted` text with a 14px bell-ring icon: off → "Get a desktop alert when you’re mentioned." + secondary sm "Enable"; on → "Desktop notifications are on for mentions." + ghost sm "Turn off"; blocked → "Desktop notifications are blocked in your browser’s site settings." Hidden where the browser has no Notification API. No reference file (built from the tokens).
- **Toast** (Step 3.3) – bottom-right, 16px from the edges; max-width 360px, `surface`, `border-strong`, 10px radius, `shadow-float`; grid `28px · 1fr · auto`: `@` icon square, "**priya** mentioned you in `#backend`" + excerpt + "View" button, ghost dismiss (32px, `aria-label="Dismiss"`); a 2px progress bar (`border` track, `accent` fill) for the auto-dismiss time. Container `role="status"` `aria-live="polite"`. Reference: §04.
- **Mobile message actions sheet** – on touch (< 768px) a long-press opens a bottom sheet instead of the hover toolbar: the message preview card above; sheet (`surface`, `border-strong`, 14px radius, `shadow-float`) with a grab handle, the 6 quick reactions as 48px round `bg-surface-2` buttons, then 52px rows "Edit message", "Copy text", "Delete message" (`danger`); a separate 52px "Cancel" button below. Edit/Delete only on your own messages. `role="dialog"` `aria-label="Message actions"`. Reference: `screens/day3-mobile-actions.html`.
- **Empty channel** – 44px `surface-2` square with an accent `#`, mono 18/600 channel name, `muted` "This is the very beginning of #x. Created by Y …" + description, secondary "Invite people" button. Reference: `screens/day2-states.html` §06.

### Realtime UI rules

These come from `screens/day2-states.html` (Day 3 additions from `screens/day3-states.html` and `screens/day3-notifications.html`) and apply wherever messages, typing or the connection are shown.

- **Optimistic send:** the message appears instantly (with a client `tempId`) as **sending**, and is replaced by the saved message on the ack. No ack within **10 s** → **failed** (text kept, retry/discard). "sent" shows only on hover.
- **Offline sends:** the composer stays usable while disconnected. Messages typed offline stay **sending…** and go out on reconnect; the 10 s timer starts only when the message is actually sent.
- **Typing:** shown just above the composer. Clears **3 s** after the last `typing:start`, or on `typing:stop`. Labels: "arjun is typing…", "arjun and priya are typing…", 3+ → "several people are typing…".
- **Scrolling:** scrolling up loads **30** older messages at a time (with the "loading older messages" pill), keeping the reading position. When the user is scrolled up and new messages arrive, **don't jump**: show the NewMessagesPill. Auto-scroll only when already near the bottom (~80px) or for the user's own sends.
- **Connection:** the warning banner while reconnecting ("attempt N"), the danger banner after repeated failures with "Retry now", the success banner for 3 s after reconnecting. The status bar mirrors it: `ws connected · 38 ms` (success dot), `ws reconnecting · attempt 2` (warning dot), `ws offline` (hollow danger ring).
- **Message actions (Day 3):** edit and delete only on **your own** messages (the server enforces it too). Delete is a soft delete: text and reactions go, the "message deleted" placeholder stays. Edits show "(edited)" for everyone via `message:updated`.
- **Reactions:** **six fixed** emoji: 👍 ❤️ 😂 🎉 👀 🙏. Clicking toggles yours; pills update live via `reaction:updated`.
- **Mentions:** `@` in the composer opens the member autocomplete (channel members, online first). Mentions of you are accent, others info.
- **Unread:** bold name + muted count (`99+` cap); mentions show an accent "@n" badge instead. The "new" divider marks the first unread message when you open a channel, and again when you return to the window with unread messages in the open channel. A channel is marked read only while it is open **and** the tab is visible **and** the window is focused. The open channel shows no badge while you're watching it, but does show its count while the window is unfocused or hidden.
- **Desktop (OS) notifications (Step 3.3 addition):** opt-in per browser. A mention while you're **not looking** (tab hidden or window unfocused) shows an OS notification instead of a toast (also for the open channel, since you aren't looking at it); clicking it focuses TeamChat and opens the message. Off or blocked → the toast waits for you as before.
- **Toasts (Step 3.3):** auto-dismiss after **6 s** (paused on hover), at most **3** stacked (newest on top), and **no toast for the channel you're already viewing**.
- **Tab title (Step 3.3):** `TeamChat` with no unread notifications, `(3) TeamChat`, and `(9+) TeamChat` from 10 up. The bell badge uses the same `9+` cap.
- **Presence:** the initial online list comes from the `presence:list` ack, then `presence:update`. A user is online while they have at least one open socket.

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
| `Input` `leading` | fixed text inside the field before the value (e.g. `#` for channel names); the wrapper draws border + focus ring |
| `Textarea` | `id` (required) · `error` (same handling as Input) |
| `Select` | `id` (required); native `<select>` styled like Input |
| `CheckboxCard` | `title` · `description`; the whole bordered card is the label |
| `Avatar` | `name` (initials via `initials()` in `initials.ts`) · `size` sm 24 / md 28 / lg 32 · `tone` accent (current workspace) / neutral / user (pass an author color class) |
| `Modal` | `title` · `onClose` · `footer`; mount to open. Native `<dialog>` + `showModal()` (inert background, Esc), focuses its first field, returns focus to the opener, max height with a scrolling body. Don't put `autoFocus` on fields inside it |
| `Drawer` | `label` · `onClose`; left slide-over (304px) on the same `<dialog>` mechanics (mobile sidebar) |
| `Banner` | `tone` warning / success / danger · `meta` (mono, right) · `action` (button) |
| `PopoverMenu` | `triggerRef` · `onClose` · `label`; with `MenuItem` (`icon`, `current`, `meta`, `kind` option/action), `MenuLabel`, `MenuDivider`. Focuses the first item, ↑/↓/Home/End, Esc/Tab/outside click close |
| `NewMessagesPill` | `count` · `onClick` |
| `MessageActionsToolbar` | `reactRef` (anchor for the picker) · `onReact` · `onEdit?` / `onDelete?(event)` (pass only for your own messages; Shift+click skips the confirm) |
| `ReactionPicker` | `triggerRef` · `onPick(emoji)` · `onClose` · position via `className`; the six `REACTIONS` from shared, ←/→/Home/End, Esc/Tab/outside click close |
| `ReactionPill` | `emoji` · `label` · `count` · `reacted` (accent, `aria-pressed`) · `who` (tooltip text) · `onClick` |
| `ConfirmDialog` | `title` · `confirmLabel` · `onConfirm` · `onClose` · `busy` · `error`; 380px `alertdialog`, focus starts on Cancel |
| `BottomSheet` | `label` · `onClose`; bottom-docked `<dialog>` (mobile actions sheet); children draw the sheet |
| `Toast` | `icon` · `title` · `body` · `actions` · `onDismiss` · `durationMs` (countdown = CSS animation on the progress bar; paused on hover/focus; hidden under reduced motion) |
| `NotificationItem` | `icon` · `tone` accent/neutral · `title` · `body` · `time` · `unread` · `onSelect`; one dropdown row (`<li><button>`) |
| `useDismiss` (hook) | `(layerRef, triggerRef, onClose)`: outside pointerdown closes, focus returns to the trigger (PopoverMenu, ReactionPicker) |

Chat pieces live in `src/features/chat/` (`MessageRow` with `state` sent/sending/failed, compact rows and Day 3 slots: `edited`, `deleted`, `mentionsMe`, `editor`, `reactions`, `toolbar`; `MessageItem` wires a saved message's actions; `MessageBody` renders mention tokens; `Reactions`, `InlineEditor`, `MentionAutocomplete`, `NewDivider`, `MessageActionsSheet`, `MessageList`, `Composer`, `TypingIndicator`, `ConnectionBanner`, `StatusBar`, `Sidebar`, `ChannelHeader`, `EmptyChannel`) and `src/features/workspace/` (onboarding, switcher, invite and create-workspace modals).

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
| 2 | App shell + channel view (Step 2.3 target) | built | `screens/day2-chat-dark.html` |
| 2 | App shell (light) | built | `screens/day2-chat-light.html` |
| 2 | Create first workspace (onboarding) | built | `screens/day2-onboarding.html` |
| 2 | Workspace switcher dropdown | built | `screens/day2-states.html` §01 |
| 2 | Create channel modal | built | `screens/day2-modals.html` |
| 2 | Invite member modal | built | `screens/day2-modals.html` |
| 2 | Empty channel state | built | `screens/day2-states.html` §06 |
| 2 | Message states: sending / failed-retry; connection banners + status bar | built | `screens/day2-states.html` §02, §05 |
| 2 | History edges (loading older, start of channel, new-messages pill) + typing indicator | built | `screens/day2-states.html` §03–04 |
| 2 | Mobile layout (drawers) | built | `screens/day2-mobile-channel.html`, `screens/day2-mobile-drawer.html` |
| 3–4 | Full-vision app shell (AI panel, SSE status, reactions, bot) | designed | `screens/chat-dark.html` |
| 3 | Channel view Day 3: reactions, (edited), deleted, mentions, "new" divider, unread sidebar (Step 3.1 target) | built | `screens/day3-chat-dark.html` |
| 3 | Channel view Day 3 (light) | built | `screens/day3-chat-light.html` |
| 3 | Message hover actions, reaction picker + pills, edit mode, delete confirm + deleted placeholder | built | `screens/day3-states.html` §01–05 |
| 3 | @mention autocomplete + mention tokens | built | `screens/day3-states.html` §06–07 |
| 3 | Unread badges + "new" divider (bell badge in Step 3.3) | built | `screens/day3-states.html` §08 |
| 3 | Mobile message actions sheet | built | `screens/day3-mobile-actions.html` |
| 3 | Notifications dropdown, empty, stream reconnecting, mention toast, tab title (Step 3.3) | built | `screens/day3-notifications.html` |
| 4 | AI panel: history list, error + retry, markdown/code | planned | – |
| 4 | Summarize modal | planned | – |
| 4 | AI usage limit reached | planned | – |
| 4 | User menu (usage, theme toggle, log out) | planned | – |
| 5 | Composer upload: drag overlay, progress, chips | planned | – |
| 5 | Attachments: image thumbnail, PDF card | planned | – |
| 5 | Link preview card | planned | – |
| 5 | Channel settings menu (export CSV) | planned | – |

**Day 3 targets:** Step 3.1 builds `day3-chat-dark.html` (+ light) and `day3-states.html` without the bell and the `sse` status-bar item, which arrive with Steps 3.2–3.3 (`day3-notifications.html`).

**Day 2 vs full vision:** `day2-chat-dark.html` (and its light twin) is the target for Step 2.3: only what Day 2 builds. `chat-dark.html` stays the full-vision reference (AI panel, reactions, bot messages, SSE status) for Days 3–4.

**Agreed differences from the Day 2 references** (the UI follows the server):
- Onboarding URL preview shows `teamchat/acme-studio-…` with "a short suffix keeps it unique" instead of "· available": slugs get a random suffix and there's no availability check.
- Create-channel hint: "1–40 characters: lowercase letters, numbers, - and _" (the server rule), not "2–40 … and dashes".
- Workspace switcher shows no unread counts until Day 3.
- Reconnecting banner shows "attempt N" without "next in 4 s" (Socket.IO doesn't expose the next retry delay).
- The workspace switcher has a "Log out" item (the Day 2 shell has no other way to log out; the user menu comes on Day 4).
- Your own row in the members list follows your socket: `connecting` (warning dot) while it reconnects.

**Agreed differences from the Day 3 references:**
- Tab title uses our product name: `(3) TeamChat AI` (the reference writes "TeamChat").
- Toasts sit bottom-right but **above the composer and status bar** (112px from the bottom on desktop, 88px on mobile), not 16px from the edge: at 16px a toast covered the Send button for 6 s.
- The bell is also in the mobile channel header (44px, borderless like the other header icons).
- The Day 2 "sent" hover label is hidden on rows that have the actions toolbar (both appear on hover in the same corner; the Day 3 reference doesn't show "sent").
- The workspace switcher shows each workspace's unread total (muted count, or the accent "@n" badge when you're mentioned), since Day 3 brings unread counts.
- Users have a display name, not a handle. Mention tokens show `@` + display name (`@Karthik S`); the autocomplete shows the name (mono 600) + email (`muted`) instead of "arjun · Arjun Mehta". The message body stores `<@userId>`, so tokens follow renames.

## 11. Change log

- 2026-11-20 – Night direction chosen; dark default + light theme; Day 1 screens designed.
- 2026-11-20 – Step 1.2b: added tokens `field`, `on-danger`, `focus-ring`; font families use the `@fontsource-variable` names; Tag text is `fg` (reference used non-token `#C9D1D9`); StatusDot gets a `live` (accent) variant; base components built.
- 2026-11-20 – Step 1.3: Login, Register and Loading built. Added tokens `skeleton-2` (was a hex note under `skeleton`), `brand-panel`, `brand-dot`, `shadow-float` (values from the references and §6); components Logo, Badge, Divider, Skeleton, FormError; TerminalCard `tone`; Input `error` accepts a ReactNode. "forgot?" and "Continue with Google" are shown disabled with a `soon` tag until PLAN Step 7.5. Tags keep `text-fg` in light (reference used non-token `#3A424D` on white).
- 2026-11-23 – Day 2 references added (`day2-*.html`): tracker rows marked designed; new components Modal, Banner, Popover menu, Avatar, MessageRow states, NewMessagesPill, history edges, typing indicator, empty channel; "Realtime UI rules"; new token `backdrop`; tints via opacity modifiers. Server gains channel descriptions and a `#random` starter channel to match the references; agreed text differences listed under the tracker.
- 2026-11-23 – Step 2.3: Day 2 screens built (app shell dark/light, onboarding, switcher, create-channel and invite modals, empty channel, message states, banners + status bar, history edges, typing, mobile drawer). Components Modal, Drawer, Banner, PopoverMenu, Avatar, Textarea, Select, CheckboxCard, NewMessagesPill; Input `leading`. Switcher gains "Log out".
- 2026-11-24 – Day 3 references added (`day3-*.html`): tracker rows marked designed (+ "Mobile message actions sheet"); tokens `accent-soft`, `info-soft`; components MessageActionsToolbar, ReactionPicker, ReactionPill, InlineEditor, deleted placeholder, MentionAutocomplete, mention token, NewDivider, NotificationsDropdown, Toast, mobile actions sheet; sidebar unread now muted count + accent "@n" mention badge; Day 3 realtime rules (own-only edit/delete, six reactions, toast 6 s / max 3 / not for the open channel, tab title).
- 2026-11-24 – Step 3.1: Day 3 channel view built (dark/light): hover toolbar, reaction picker + pills with tooltip, inline edit, delete confirm (Shift+click skips) + placeholder, mention autocomplete + tokens + "mentions you" tint, unread/mention badges in the sidebar and switcher, "new" divider, mobile long-press actions sheet. Components MessageActionsToolbar, ReactionPicker, ReactionPill, ConfirmDialog, BottomSheet, `useDismiss`. "sent" hover label hidden where the toolbar shows.
- 2026-11-24 – Step 3.3: notifications UI built: bell with "9+" badge (desktop + mobile header), NotificationsDropdown (empty state, stream status footer, Load older, ↑/↓, Esc), mention toasts (6 s, pause on hover/focus, max 3, not for the open channel), tab title, status-bar `sse` item, message highlight when opened from a notification. Components Toast, NotificationItem. Toasts lifted above the composer.
- 2026-11-24 – Step 3.3 addition (user request): desktop (OS) notifications for mentions while TeamChat isn't being looked at; opt-in toggle in the notifications dropdown.
