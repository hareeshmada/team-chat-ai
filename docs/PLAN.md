# TeamChat AI: 7-Day Build Plan with Claude Code

Nov 16, 2026 · @hareesh

## How to use this guide

You will ship a working, deployed team chat app with an AI assistant in 7 days, using Claude Code to write most of the code while you review, test and understand every piece. Plan for about 8–10 focused hours a day. Each day ends with something that runs and a git commit, so a bad day never breaks the whole week.

**What you are building:** TeamChat AI. Users sign up, create workspaces and channels, chat in real time, get live notifications, ask an AI assistant that streams its answers, upload files, and use an app that has measured, documented performance work on both frontend and backend.

**Scope for one week.** The core list below is the target. Stretch items are only for spare hours on Day 7 or after the week.

| Area | Core (build this week) | Stretch (only if time) |
| --- | --- | --- |
| Auth | Email + password, JWT access/refresh, roles | Google OAuth |
| Real-time | WebSockets chat, SSE notifications, HTTP streaming for AI | 1:1 WebRTC video call |
| AI | Streaming assistant, channel summary, rate limit + token tracking | RAG over uploaded PDFs |
| Backend | Redis cache, BullMQ jobs, cursor pagination, indexes | k6 load test in CI |
| Frontend | Virtualized list, lazy routes, optimistic UI, TanStack Query | PWA / offline |
| Delivery | Tests, Docker, GitHub Actions, live deploy, README | Sentry, demo video |

**Tech stack (fixed, so you don't lose time deciding):** TypeScript everywhere; React + Vite + TanStack Query + Zustand + Tailwind on the client; Node + Express + Mongoose + Socket.IO + Zod on the server; MongoDB Atlas; Redis (Upstash or Docker); BullMQ; Google Gemini API for AI (changed from Anthropic, see PROGRESS); Cloudinary for files; Vitest, Supertest and Playwright for tests.

### The loop you repeat for every step

1. **Plan first.** Paste the step's prompt into Claude Code in Plan mode. Read the plan; push back if it adds things you didn't ask for.
2. **Build.** Approve the plan and let Claude Code write the code. Keep each step small: one feature, a few files.
3. **Review the diff.** Read every changed file. If any line is unclear, ask: "Explain this file line by line and why you chose this approach."
4. **Run and verify.** Use the "Verify" checks under each step. Never move on with a broken step.
5. **Commit.** `git commit` after each verified step with a clear message. If a later step goes wrong, you can roll back.
6. **Learn.** Ask the "Learn" questions listed in each step and write the answers in your own words in a `NOTES.md`. This file becomes your interview prep.

**Context hygiene:** start each day (or each major feature) with `/clear` so old context doesn't confuse Claude Code. Your `CLAUDE.md` file carries the project rules across sessions, so keep it updated. See the [Claude Code docs](https://docs.claude.com/en/docs/claude-code/overview) for commands and setup.

## Day 0 (the evening before): setup, 2–3 hours

Goal: every account, key and tool is ready, and Claude Code knows your project rules before Day 1 starts.

### Accounts and keys

- [ ] Install the current Node LTS, Git, Docker Desktop and VS Code.
- [ ] Install Claude Code ([setup guide](https://docs.claude.com/en/docs/claude-code/overview)) and log in.
- [ ] Create a free MongoDB Atlas cluster; copy the connection string.
- [ ] Create a free Redis database on Upstash (or plan to run Redis in Docker locally).
- [ ] Get a Gemini API key from Google AI Studio (free tier; changed from Anthropic, see PROGRESS).
- [ ] Create a free Cloudinary account for file uploads.
- [ ] Create an empty GitHub repo called `teamchat-ai`.

### Folder structure

Use a simple npm workspaces monorepo so types and Zod schemas are shared:

```
teamchat-ai/
  apps/
    client/        React + Vite
    server/        Express + Socket.IO
  packages/
    shared/        Zod schemas, TypeScript types, socket event names
  docker-compose.yml
  CLAUDE.md
  NOTES.md
```

### Write CLAUDE.md

This file is read by Claude Code in every session. It keeps the code consistent across 7 days. Create it in the repo root:

```markdown
# TeamChat AI – project rules

## Versions
- Always use the latest stable version of every library.
- package.json is the source of truth for versions. Before using a library's API,
  check the installed version and use that version's current API, not older patterns.
- Never downgrade a package or use deprecated APIs to make something work; tell me instead.
- Node: current LTS.

## Stack
- TypeScript strict mode everywhere
- Client: React + Vite, TanStack Query (server state), Zustand (UI state), Tailwind CSS, React Router
- Server: Node, Express, Mongoose, Socket.IO, Zod, Pino logger
- Shared: packages/shared holds Zod schemas, types and socket event names
- Tests: Vitest + Supertest (server), Vitest + Testing Library (client), Playwright (E2E)

## Server architecture
- routes -> controllers -> services -> models. No DB calls in controllers.
- Validate every request body/query/params with Zod middleware.
- Throw AppError(status, code, message); one central error handler.
- Never log secrets or tokens.

## Conventions
- Small focused files, named exports, async/await only.
- Every new endpoint gets a Supertest test.
- Env vars validated with Zod at startup in config/env.ts.
- Cursor-based pagination for lists (never skip/limit).

## How to work with me
- Show a plan before large changes.
- Do one step at a time; don't add features I didn't ask for.
- After coding, tell me exactly how to run and verify it.
- When I ask "explain", teach me like a mid-level dev preparing for interviews.
```

### First prompt

Open Claude Code in the repo folder and run:

> Read CLAUDE.md. Scaffold the monorepo exactly as described: npm workspaces with apps/client (Vite React TS + Tailwind), apps/server (Express TS with tsx for dev), and packages/shared. Add ESLint + Prettier, a root `dev` script that runs client and server together, a `.env.example` for each app, and a docker-compose.yml with Redis only. Add a GET /health endpoint. Don't build any features yet.

**Verify:** `npm run dev` starts both apps; `http://localhost:5173` loads; `/health` returns `{ status: "ok" }`. Commit: `chore: scaffold monorepo`.

## Day 1: foundation and auth

By tonight a user can sign up, log in, stay logged in after a refresh, and log out, with tests proving it. Auth comes first because every later feature (sockets, SSE, AI limits) needs to know who the user is.

### Step 1.0 – Pre-flight check of the scaffold (about 30 min)

**What it is:** a few wiring fixes that every later step depends on. Skipping them causes cookie, CORS and test problems on Day 1 itself.

> Read CLAUDE.md. Check the monorepo before we build features: (1) confirm apps/client and apps/server can both import a test Zod schema from packages/shared in dev and in a production build, and that both use the same Zod version; (2) split the server into app.ts (builds and exports the Express app) and server.ts (connects the DB and listens) so tests can import the app without starting a server; (3) add a Vite dev proxy so /api and /socket.io (with ws: true) go to the server, making dev same-origin; (4) set up Vitest + Supertest + mongodb-memory-server for server tests with one sample test. Use the installed versions' current APIs (Express 5 forwards async errors on its own, so don't add express-async-errors). Report what you changed.

**Verify:** the sample test runs against in-memory Mongo; in the browser console, `fetch('/api/health')` works through the proxy.

**Learn:** "Why separate app.ts from server.ts?" · "Why does a dev proxy remove cookie and CORS problems?"

### Step 1.1 – Server foundation (about 1.5 h)

**What it is:** the skeleton every endpoint will use: validated env config, MongoDB connection, structured logging, one error format, request validation and clean shutdown.

> Build the server foundation in apps/server: config/env.ts that validates env vars with Zod and exits with a clear message on failure; a Mongoose connection module with retry; a Pino logger with a request id per request (pino-http); an AppError class and a central error handler that returns { error: { code, message } } and hides stack traces in production; a validate(schema) middleware for body/query/params; helmet, cors (origin from env, credentials true, for production), express.json with a 100kb limit, cookie-parser; graceful shutdown on SIGTERM/SIGINT that closes HTTP and Mongo. Write Supertest tests for /health, a 404 route and a validation error.

**Verify:** tests pass; a wrong `MONGODB_URI` makes the server exit with a clear message; every log line has a request id.

**Learn:** "Why validate env vars at startup?" · "What does graceful shutdown protect against?"

### Step 1.2 – Auth API with refresh-token rotation (about 2.5 h)

**What it is:** a short-lived access token (15 min) sent in the `Authorization` header, plus a long-lived refresh token (7 days) in an httpOnly cookie. Each refresh issues a new refresh token and revokes the old one (rotation); reuse of an old token revokes the whole session family.

> Implement auth. User model: name, email (unique, lowercase, trimmed), passwordHash (bcryptjs, 12 rounds, select: false, never returned in JSON), avatarUrl, createdAt. RefreshToken model: userId, tokenHash (SHA-256), family, expiresAt (TTL index), revokedAt, replacedBy. Refresh tokens are opaque random strings (crypto.randomBytes(48)), not JWTs. Endpoints under /api/auth: POST register, POST login (same generic "Invalid email or password" for a wrong email or a wrong password), POST refresh (rotate: revoke the old token and issue a new one in the same family; if a revoked token is reused within 10 seconds of rotation, e.g. two tabs refreshing at once, treat it as valid; if reused after that, revoke the whole family and return 401), POST logout (revoke the family, clear the cookie), GET me. Access token: JWT, 15 min, signed with JWT\_ACCESS\_SECRET, payload only { sub: userId }, returned in the response body. Refresh cookie: httpOnly, path=/api/auth, maxAge 7 days, secure only in production, sameSite from a COOKIE\_SAMESITE env var (default strict). requireAuth middleware sets a typed req.user. Register/login Zod schemas live in packages/shared. Rate limit login and register to 10 req/min per IP, disabled when NODE\_ENV=test. Supertest tests for every endpoint, including rotation, reuse detection, the grace window and logout.

**Verify:** tests pass; in Postman, login → refresh works; using an old refresh token more than 10 seconds after it was rotated returns 401 and kills the session; `document.cookie` in the browser never shows the refresh token.

**Learn:** "Why store the refresh token as a hash?" · "Why httpOnly cookie for refresh but not for access?" · "What attack does rotation with reuse detection stop?" · "Why is the refresh token an opaque random string and not a JWT?"

### step 1.2b
Read docs/DESIGN.md. Set up the design foundation in apps/client: the Tailwind 4 theme CSS from section 4, Inter and JetBrains Mono via @fontsource-variable, the theme system from section 2 (data-theme on html, saved in localStorage, inline script in index.html to avoid a flash), and these UI components from section 8: Button, Input, Label, TerminalCard, Tag, StatusDot, ThemeToggle. Add a temporary /dev/ui route showing every component in both themes. Don’t build any screens yet.

### Step 1.3 – Client auth (about 2.5 h)

Build the screens to match docs/design/screens/login-dark.html, register-dark.html and loading-dark.html, using the components from src/components/ui. Move the temporary dev-only `/dev/ui` page (currently a pathname check in App.tsx) into the router, still dev-only.

**What it is:** login and signup screens, an API client that silently refreshes an expired access token, and protected routes.

> In apps/client set up React Router with routes /login, /register and a protected /app layout. Create an api client (fetch with credentials: 'include') that attaches the access token from a Zustand auth store, and on a 401 refreshes and retries. Refresh must be single-flight: one module-level promise shared by the 401 handler and the app-load session restore, so parallel requests and React StrictMode's double effects never send two refresh calls. On app load, show a loading screen while calling refresh then /me, so there's no flash of the login page. If refresh fails, clear the store and redirect to /login. Use a BroadcastChannel so logging out in one tab logs out all tabs. Build clean Tailwind login/register forms with react-hook-form + the shared Zod schemas and inline errors. Keep the access token in memory only, never localStorage.

**Verify:** sign up, reload the page and stay logged in; wait or shorten the access token to 30 s and confirm requests still work; log out and confirm /app redirects to /login; with two tabs open, logging out in one logs out the other; the Network tab shows only one refresh call on page load.

**Learn:** "Why queue requests during a refresh?" · "Why not keep the token in localStorage?"

### End of day

- [x] All server tests green
- [ ] Commit: `feat: auth with refresh-token rotation`
- [ ] Write 5 lines in NOTES.md on how your auth flow works, from memory

## Day 2: workspaces, channels and real-time chat (WebSockets)

By tonight two browser windows logged in as different users can chat instantly in the same channel, with typing indicators and online status. WebSockets fit chat because both sides send messages constantly and latency matters.

### Step 2.1 – Workspaces, channels and roles (about 2 h)

**What it is:** the data model everything hangs on. A workspace has members with roles (owner, admin, member); a workspace has channels; a user only sees what they belong to.

> Add models: Workspace (name, slug, ownerId), Membership (workspaceId, userId, role: owner|admin|member, unique compound index), Channel (workspaceId, name, isPrivate, createdBy), Message (channelId, authorId, body, attachments\[\], createdAt, editedAt; compound index { channelId: 1, \_id: -1 }). REST: create/list workspaces, invite member by email, list/create channels. Add requireMembership(role?) middleware for role checks. Message history endpoint GET /api/channels/:id/messages with cursor pagination (before=\<messageId>, limit=30). Supertest tests for permission checks: a non-member gets 403.

**Verify:** a second user can't read a channel in a workspace they don't belong to.

**Learn:** "Why cursor pagination instead of skip/limit?" · "Why is the index { channelId, \_id } and not just channelId?"

### Step 2.2 – Socket.IO server (about 2 h)

**What it is:** a persistent two-way connection per user. Each channel is a Socket.IO room; sending a message saves it to Mongo, then broadcasts it to the room.

> Add Socket.IO to the server, sharing the HTTP server. Authenticate the handshake with the access token (auth.token) and reject invalid tokens. Put socket event names and payload Zod schemas in packages/shared. Events: channel:join / channel:leave (check membership), message:send with a client-generated tempId and an acknowledgement callback returning the saved message, message:new broadcast to the room, typing:start / typing:stop (throttled), presence: track online users per workspace in memory (a Map of userId → socket count) and emit presence:update. Validate every incoming event with Zod. Write a test with socket.io-client for send + receive.

**Verify:** the socket test passes; a socket with no token is rejected.

**Learn:** "How is Socket.IO different from raw WebSocket?" · "Why use acknowledgements?" · "What breaks if I run two server instances?" (answer: rooms and presence live in one process's memory; the fix is the Redis adapter)

### Step 2.3 – Chat UI (about 3 h)

**What it is:** the screen people will judge the app by. Sidebar with workspaces and channels, a message list, a composer, typing indicator and presence dots.

> Build the /app layout: left sidebar (workspace switcher, channel list, create channel modal), main channel view (header, message list, composer). Create a useSocket hook that connects with the access token, reconnects with the fresh token after refresh, and joins/leaves channel rooms on navigation. Load history with TanStack Query useInfiniteQuery (scroll up loads older). Optimistic send: insert the message with tempId and a "sending" state, replace it on ack, show "failed – retry" on error. Show "X is typing…" and green online dots (initial state from the `presence:list` ack, then `presence:update`; message:new also reaches the sender, so de-duplicate by tempId). Auto-scroll to bottom only when the user is already near the bottom.

> *As built (see PROGRESS):* screens follow `docs/design/screens/day2-*.html`, plus an onboarding screen (`/app` with no workspace), an invite-member modal, a connection banner + status bar with latency (`latency:ping`), a mobile drawer, and `workspace:added` so an invite or a new workspace reaches open tabs live. The socket is a module singleton (`lib/socket.ts`) plus feature hooks instead of a single `useSocket` hook.

**Verify:** open two browsers (one normal, one incognito) with two users; messages, typing and presence update instantly; stop the server and confirm the UI shows a "reconnecting" banner and recovers.

**Learn:** "How does optimistic UI work and how do you roll it back?" · "How does the socket get a new token after refresh?"

### End of day

- [ ] Two-user chat works in two browsers
- [ ] Commit: `feat: workspaces, channels and realtime chat`
- [ ] NOTES.md: draw the message flow from typing "Enter" to the other user's screen

## Day 3: chat polish and notifications (SSE)

By tonight chat feels like a real product (mentions, reactions, edits, unread counts) and users get live notifications pushed over Server-Sent Events. SSE fits notifications because data flows one way (server → client), it runs over plain HTTP, and the browser reconnects and resumes automatically. This day is lighter on purpose: use spare time to catch up on Days 1–2.

### Step 3.1 – Message features (about 2.5 h)

**What it is:** the small details that make chat feel finished.

> Add to messages: edit and delete (author only, soft delete shows "message deleted"), emoji reactions (toggle, stored as { emoji, userIds\[\] }), @mentions parsed on the server into mentionedUserIds, and unread counts per channel using a ChannelRead model (userId, channelId, lastReadMessageId). Broadcast message:updated, message:deleted and reaction:updated over sockets. In the UI: hover actions on a message, reaction pills, bold channel names with an unread badge, and mark-as-read when the channel is open and the window is focused. Add tests for edit permissions and unread count logic.

> *As built (see PROGRESS):* screens follow `docs/design/screens/day3-*.html`. Mentions are `<@userId>` tokens picked from an `@` autocomplete (users have no handle); six fixed reactions; edit/delete/react are acked socket events (`message:edit`, `message:delete`, `reaction:toggle`); unread comes from `GET /api/unread` + `POST /api/channels/:id/read` and stays live through a small `channel:activity` event (no need to join every channel room) and `channel:read` for your other tabs. Mention counts (`@n` badge), a "new" divider, workspace totals in the switcher and a mobile long-press actions sheet come from the references.

**Verify:** in two browsers, edits, deletes and reactions sync instantly; unread badges clear when you open the channel.

**Learn:** "Why soft delete?" · "How is the unread count calculated cheaply?"

### Step 3.2 – SSE notification stream (about 2.5 h)

**What it is:** a long-lived HTTP response with `Content-Type: text/event-stream` that the server writes events into. Each event has an id, so after a disconnect the browser sends `Last-Event-ID` and the server replays what was missed.

> Build notifications. Notification model: userId, type (mention|invite|ai\_done|system), payload, readAt, createdAt (index { userId: 1, \_id: -1 }). Create an internal event bus (typed EventEmitter in a single module, so it can later be swapped for Redis pub/sub). When a user is @mentioned or invited, save a Notification and emit it on the bus. Endpoint GET /api/notifications/stream: browsers' EventSource can't send headers, so first add POST /api/notifications/stream-ticket that returns a 60-second single-use ticket, and authenticate the stream with ?ticket=. On connect, replay notifications newer than the Last-Event-ID header. Send `id:` and `event:` fields, a heartbeat comment every 25 s, set X-Accel-Buffering: no, and remove the listener on client disconnect. Also add GET /api/notifications (paginated) and POST /api/notifications/read.

> *As built (see PROGRESS):* the stream also accepts `?lastEventId=` (a fresh EventSource with a new ticket can't set the `Last-Event-ID` header; Step 3.3 uses it on every reconnect). Payloads keep a copy of names + a 140-char excerpt; an edit notifies only newly mentioned people; no notification for mentioning yourself. Tickets live in memory (hashed, 60 s, single use) until Day 5's Redis. Max 5 open streams per user; `?ticket=` is redacted in request logs; shutdown ends open streams.

**Verify:** `curl -N` on the stream URL prints events as you @mention that user from another browser; kill the connection, send two mentions, reconnect with the Last-Event-ID header, and confirm both are replayed.

**Learn:** "SSE vs WebSockets: when do you pick each?" · "Why the heartbeat?" · "Why a ticket instead of putting the JWT in the URL?"

### Step 3.3 – Notification UI (about 1.5 h)

> Create a useNotificationStream hook that fetches a ticket, opens an EventSource, gets a fresh ticket on reconnect, and pushes events into TanStack Query's cache. Add a bell icon with an unread count, a dropdown list with mark-all-read, toast popups for new mentions, and the browser tab title showing "(3) TeamChat" when unread exists.

> *As built (see PROGRESS):* the stream hook opens a NEW EventSource with a fresh ticket and `?lastEventId=` on every reconnect (backoff 1 s → 30 s + jitter, instant retry on `online`), never EventSource's own retry. The server also sends `event: read` so the bell updates in every tab, and reading a channel clears its mention notifications. Toasts skip the open channel and replayed mentions older than 60 s; clicking a notification or "View" opens the channel and flashes the message. Status bar shows `sse connected · last event 10:20`. Added on request: opt-in desktop (OS) notifications for mentions while TeamChat isn't being looked at (browser Notification API).

**Verify:** a mention from user B shows a toast for user A within a second, even when A is in a different channel.

### End of day

- [ ] Notifications work and survive reconnects
- [ ] Commit: `feat: message features and SSE notifications`
- [ ] NOTES.md: a 3-row table comparing polling, SSE and WebSockets

## Day 4: AI assistant with streaming

By tonight users can ask an AI assistant questions and watch the answer appear word by word, stop it mid-answer, summarize a channel, and are held to a daily usage limit. This adds the third communication technique: plain HTTP streaming (a chunked response read with `fetch` + `ReadableStream`), plus streaming AI output into a channel over your existing sockets.

### Step 4.1 – AI service and streaming endpoint (about 2.5 h)

**What it is:** the server calls the Gemini API with streaming on and forwards each text chunk to the browser as it arrives, instead of waiting 10 seconds for the full answer.

> Install @google/genai. Create services/ai.service.ts that wraps the SDK (the only file that knows the provider); read the key from GEMINI\_API\_KEY and the model name from an AI\_MODEL env var (pick a current Flash model from Google AI Studio's model list). Add POST /api/ai/chat (requireAuth) taking { conversationId?, message }. Stream the reply as a chunked text/plain response: set headers, flushHeaders, write each text delta with res.write, then end. Listen for req 'close' and abort the SDK stream so a cancelled request stops costing tokens. Save AiConversation (userId, messages\[\] with role/content, createdAt) so follow-up questions include history (last 20 messages). Add a system prompt describing the assistant's role. Handle API errors and timeouts with a clean error message.

**Verify:** ` curl -N -X POST ...  ` shows text arriving in pieces; pressing Ctrl+C stops the stream and the server log shows it was aborted.

**Learn:** "Chunked HTTP streaming vs SSE: what's the difference?" · "What is backpressure and does it matter here?" · "Why abort on client disconnect?"

> *As built (see PROGRESS):* Gemini (`@google/genai`) behind `services/ai.service.ts`. Headers are sent with the FIRST piece of text (not before), so errors before any text are still JSON with a real status: 429/503 → `AI_BUSY`, 504 `AI_TIMEOUT` (30 s without text), 502 `AI_ERROR` / `AI_EMPTY`. The conversation id comes back in an `X-Conversation-Id` header. The question and answer are saved together at the end; a stopped answer is saved partial with `stopped: true`. SDK retries are off (they hung on a 503). 20 questions/min per user.

### Step 4.2 – Assistant UI (about 2 h)

> Add an AI assistant side panel. Send with fetch and read response.body with getReader() + TextDecoder, appending chunks to the last message in state. Add a Stop button using AbortController. Render markdown safely (react-markdown, no raw HTML) with code highlighting. Show a blinking cursor while streaming, disable send while busy, list past conversations, and handle errors with a retry button.

**Verify:** long answers stream smoothly; Stop halts it instantly; reloading shows the saved conversation.

> *As built (see PROGRESS):* matches `docs/design/screens/day4-*.html`. Added `GET /api/ai/conversations` (cursor on `updatedAt` + id) and `GET /api/ai/conversations/:id` for the history list and reload. The panel is lazy-loaded (markdown + highlight.js stay out of the main bundle); stream pieces are applied once per animation frame; tok/s is an estimate. Esc stops; a stopped or cut-off answer is kept and labelled "stopped" (the server saves it the same way); Retry resends the question. 340px column (open by default ≥ 1280px), full screen on mobile.

### Step 4.3 – `@ai` in channels and channel summary (about 2 h)

**What it is:** AI inside the team chat. A message starting with `@ai` gets a reply from an AI bot user, streamed to everyone in the channel over WebSockets. A "Summarize" button produces a catch-up summary.

> When a message starts with @ai, create a placeholder bot message, call the AI with the last 30 channel messages as context, and emit ai:chunk { messageId, delta } to the channel room as text arrives, then message:updated with the final text. Wrap channel messages in clear delimiters in the prompt and tell the model to treat them as data, not instructions (basic prompt-injection defense). Add POST /api/channels/:id/summary that streams a bullet summary of the last 100 messages, and a Summarize button in the channel header that shows it in a modal.

**Verify:** in two browsers, both users see the bot reply typing out live.

**Learn:** "How does the same AI stream reach many users?" · "What is prompt injection and how did you reduce it?"

> *As built (see PROGRESS):* the bot is not a user account: its messages use a fixed `AI_BOT_ID` + an `ai` field (`askedById`, `questionId`, `status`, `contextCount`). `ai:chunk` carries `{ delta, offset }` so a client that joined mid-answer never garbles the text; the partial answer is saved every ~2 s. A failure deletes the placeholder and sends `ai:failed` (the asker gets a retry via `ai:retry`). One `@ai` answer at a time per user. Context excludes messages after the question; mentions become names; a fake closing marker is stripped. The summary sends its count and time range in `X-Summary-*` headers; Esc stops it, closing aborts.

### Step 4.4 – Usage limits and cost tracking (about 1 h)

> Record AiUsage (userId, inputTokens, outputTokens, feature, createdAt) from the SDK's usage data on every call. Enforce a per-user daily token limit with a Redis counter (INCRBY + EXPIRE at midnight); return 429 with a friendly message when exceeded. Show "AI usage today: X / Y tokens" in the user menu.

**Verify:** lower the limit to a tiny number and confirm the 429 and the UI message.

> *As built (see PROGRESS):* Redis (ioredis 6) arrives here, a day before Day 5: key `ai:usage:<userId>:<day>`, checked before each call (429 `AI_LIMIT_REACHED` with the usage as details) and increased after it with `MULTI INCRBY + EXPIREAT` next midnight in `AI_USAGE_TIMEZONE`. Applies to the panel, Summarize and `@ai` (the asker pays; at the limit the message is still sent, no bot answer). Stopped answers are charged Gemini's counts or a characters ÷ 4 estimate. Redis down = fail open (logged). `GET /api/ai/usage` + an `ai:usage` socket event keep every meter live. The user menu replaces the switcher's Log out and the sidebar theme button.

### End of day

- [ ] Streaming assistant, @ai in channels, summary, limits all work
- [ ] Commit: `feat: streaming AI assistant with usage limits`
- [ ] NOTES.md: explain your three real-time techniques and why each feature uses the one it does

## Day 5: files, background jobs, Redis and scaling

By tonight users can share files, slow work runs in background jobs instead of inside requests, hot data is cached in Redis, and the app runs correctly on two server instances at once. These are the backend skills that separate a mid-level developer from a junior.

### Step 5.1 – Direct file uploads (about 1.5 h)

**What it is:** the browser uploads straight to Cloudinary using a short-lived signature from your server, so large files never pass through (or block) your Node process.

> Add POST /api/uploads/sign (requireAuth) that returns a Cloudinary signed-upload signature limited to the user's folder, max 10 MB, and allowed types (images, PDF). In the composer, add drag-and-drop and a paperclip button; upload directly to Cloudinary with a progress bar, then send the message with attachments \[{ url, type, name, size, width, height }\]. Render image thumbnails using Cloudinary transformation URLs (w\_400, f\_auto, q\_auto) with lazy loading, and file cards for PDFs.

**Verify:** a 5 MB image uploads with a progress bar and shows as a thumbnail for both users; server memory stays flat.

**Learn:** "Why signed direct uploads instead of uploading through Express?"

### Step 5.2 – Background jobs with BullMQ (about 2 h)

**What it is:** a Redis-backed job queue. The request adds a job and returns immediately; a separate worker process does the slow work, with retries.

> Add BullMQ with a separate worker entry (apps/server/src/worker.ts, its own npm script). Jobs: (1) invite-email: send a workspace invite email via Resend (or Ethereal in dev) with 3 retries and exponential backoff. Also add pending invites for emails that have no account yet (today `POST /api/workspaces/:id/members` returns 404 `USER_NOT_FOUND` for them); the invite is accepted on signup; (2) link-preview: when a message contains a URL, fetch its title/description/image with a 5 s timeout and size limit, save it on the message and emit message:updated so the preview appears live. Block private IPs and localhost in the fetcher to prevent SSRF. Add Bull Board at /admin/queues, protected by an admin check.

**Verify:** paste a link in chat; the message appears instantly and the preview card appears a second later. Stop the worker, send links, restart it, and watch the queued jobs complete.

**Learn:** "Why a separate worker process?" · "What does idempotency mean for a job that retries?" · "What is SSRF?"

### Step 5.3 – Streaming CSV export (about 1 h)

**What it is:** exporting 100k messages without loading them all into memory, using a Mongo cursor piped through a Node transform stream into the response.

> Add GET /api/channels/:id/export.csv (admin only) that uses Message.find().cursor() piped through a Transform stream that outputs CSV rows into the response with pipeline() from stream/promises, so backpressure and errors are handled. Add a seed script that creates 100k messages in one channel for testing.

**Verify:** export 100k rows while watching `process.memoryUsage()` in logs; memory should stay roughly flat. Note the numbers for your README.

### Step 5.4 – Redis cache and horizontal scaling (about 2.5 h)

**What it is:** caching data that's read often but changes rarely, and making sockets, presence and SSE work across multiple server instances.

> (1) Cache workspace membership checks and channel lists in Redis using cache-aside with a 5-minute TTL, and delete the keys whenever membership or channels change. Log cache hit/miss. (2) Add @socket.io/redis-adapter so broadcasts reach sockets on any instance. (3) Move presence from the in-memory Map to Redis (a set per workspace plus per-user connection counts), and the socket message:send rate limiter to Redis. (4) Swap the internal event bus for Redis pub/sub so SSE notifications reach a user connected to any instance. (5) Add a docker-compose profile that runs two server instances behind Nginx with sticky sessions for Socket.IO.

**Verify:** run the two-instance setup; connect user A to instance 1 and user B to instance 2; chat, presence and notifications still work.

**Learn:** "What is cache invalidation and where can it go wrong?" · "Why does Socket.IO need sticky sessions?" · "How does the Redis adapter work?"

### End of day

- [ ] Uploads, jobs, export and two-instance mode all work
- [ ] Commit: `feat: uploads, background jobs, redis cache and scaling`
- [ ] NOTES.md: draw the architecture (client, Nginx, 2 servers, worker, Mongo, Redis, Cloudinary, Gemini API)

## Day 6: performance pass (measure, fix, measure again)

By tonight you have a `PERFORMANCE.md` with real before-and-after numbers for frontend and backend. This is your headline feature in interviews, so the rule is strict: **no optimization without a number before and after it.**

### Step 6.1 – Baseline (about 1.5 h)

> Create scripts/seed-perf.ts that creates 1 workspace, 50 users, 20 channels and 100k messages (most in one "#general" channel). Add rollup-plugin-visualizer to the client build. Add a k6 script (load/messages.js) that logs in and hits GET channel messages and the channel list with 50 virtual users for 30 s. Add a PERFORMANCE.md template with tables for frontend and backend metrics (before / after / change). Don't optimize anything yet.

Then measure and record, by hand:

- [ ] Lighthouse (production build, incognito): Performance score, LCP, TBT, CLS
- [ ] Main JS bundle size (gzip) from the visualizer
- [ ] React Profiler: render time when opening #general and scrolling 2,000 messages
- [ ] `explain("executionStats")` for the messages query: docs examined vs returned, time
- [ ] k6: requests/sec and p95 latency for both endpoints

### Step 6.2 – Frontend optimizations (about 3 h)

> Using the baseline in PERFORMANCE.md, optimize the client: (1) virtualize the message list with @tanstack/react-virtual, supporting variable row heights and keeping scroll position when older messages load; (2) lazy-load routes and heavy components (AI panel, markdown renderer, emoji picker, Bull Board link) with React.lazy + Suspense; (3) use manualChunks to split vendor code; (4) memoize MessageItem with React.memo and stable callbacks, and keep typing/presence state out of the list component so typing doesn't re-render all messages; (5) debounce channel search; (6) preload the main font, use font-display: swap; (7) add width/height to images to prevent layout shift. After each change, tell me how to measure its effect.

**Learn:** "How does list virtualization work?" · "Why did typing re-render every message before?" · "What are LCP, INP and CLS?"

### Step 6.3 – Backend optimizations (about 2.5 h)

> Using the baseline, optimize the server: (1) confirm the messages query uses the { channelId, \_id } index and returns only needed fields with .select() and .lean(); (2) replace per-message author lookups with one batched user query (fix N+1) or an aggregation; (3) add compression middleware; (4) add ETag/Cache-Control headers for the channel list; (5) confirm Redis cache hit rate on membership checks; (6) set a sensible Mongoose maxPoolSize. Show me explain() output before and after.

**Learn:** "What does lean() skip and why is it faster?" · "What is an N+1 query?" · "What do p95 and p99 mean and why not use average?"

### Step 6.3b – CPU work off the event loop with worker threads (about 1.5 h, added on request)

**What it is:** proving that CPU-heavy JavaScript freezes a Node server for everyone, then fixing it with `worker_threads`, with numbers before and after. The I/O in this app never blocks; this step adds a real CPU-bound feature to show the difference.

> Add GET /api/channels/:id/insights (member+): over the channel's messages (the 100k seeded ones), compute top 20 words (tokenize, lowercase, drop stop words), messages per user, and busiest hours. First implement it on the main thread. Measure: event-loop delay with perf_hooks.monitorEventLoopDelay (log p50/p99/max), and run the k6 messages script while insights requests run, recording p95 of the messages API and the status bar latency. Then move the computation to a worker thread pool (Piscina, sized from os.availableParallelism()), loading the messages with a cursor on the main thread and sending plain arrays to the worker (or let the worker open its own read). Add a timeout and a queue limit (429 when the pool is full). Re-measure under the same load and record both in PERFORMANCE.md.

**Verify:** before: event-loop p99 jumps to hundreds of ms and the messages API p95 rises while insights run; after: both stay flat while insights still return the same result. A test checks the worker result equals the main-thread result.

**Learn:** "When does Node's event loop block, and when doesn't it?" · "worker_threads vs a child process vs cluster vs a job queue: when do you use each?" · "How does data get to a worker (structured clone, transferable buffers, SharedArrayBuffer) and what does it cost?"

### Step 6.4 – Re-measure and write it up (about 1 h)

Run every measurement from Step 6.1 again under the same conditions and fill in the table. Ask Claude Code to help word each row, but the numbers must be yours.

| Metric | Before | After | What changed |
| --- | --- | --- | --- |
| Lighthouse performance |  |  |  |
| LCP (s) |  |  |  |
| Main bundle, gzip (KB) |  |  |  |
| Open #general render (ms) |  |  |  |
| Messages query: docs examined |  |  |  |
| Messages API p95 (ms) |  |  |  |
| Messages API req/s |  |  |  |
| Export 100k rows: peak memory (MB) |  |  |  |
| Event-loop delay p99 during insights (ms) |  |  |  |
| Messages API p95 while insights run (ms) |  |  |  |

### End of day

- [ ] PERFORMANCE.md complete with screenshots
- [ ] Commit: `perf: frontend and backend optimizations with measurements`

## Day 7: tests, Docker, CI, deploy and README

By tonight the app is live at a public URL with a demo account, every push runs tests automatically, and the README sells the project in 60 seconds. A deployed project with a clear README gets far more attention than a better project that only runs locally.

### Step 7.1 – E2E tests (about 1.5 h)

> Add Playwright with 4 tests: (1) register → create workspace → create channel; (2) two browser contexts as two users: A sends a message and B sees it live; (3) A @mentions B and B gets a notification toast; (4) ask the AI assistant a question and see a streamed answer (mock the AI service in test mode with a fake stream so tests are free and deterministic). Add a test-only seed endpoint enabled only when NODE\_ENV=test.

**Verify:** `npx playwright test` passes headless, three runs in a row (no flaky tests).

### Step 7.2 – Docker and CI (about 1.5 h)

> Write multi-stage Dockerfiles for server (and worker using the same image with a different command) and client (build with Vite, serve with Nginx). Update docker-compose.yml so `docker compose up` runs client, server, worker, Mongo and Redis. Add a GitHub Actions workflow: on push and PR run install with cache, lint, typecheck, unit/API tests (with Mongo and Redis service containers) and Playwright; on main, trigger deploy.

**Verify:** a fresh clone runs with one `docker compose up`; the Actions tab shows green.

### Step 7.3 – Deploy (about 2 h)

**Simple, free-tier-friendly setup:** client on Vercel or Netlify; server and worker on Render or Railway; MongoDB Atlas; Upstash Redis. Make sure your host supports WebSockets and long-lived HTTP responses (both needed for chat, SSE and streaming).

> Prepare for production: set CORS and cookie settings for the deployed client domain (sameSite, secure, and the right cookie domain if client and API are on different domains), trust proxy, production log level, and a /ready endpoint that checks Mongo and Redis. Add Sentry to client and server. Write a seed script for a demo workspace with realistic messages and a demo login (demo@teamchat.dev). Tell me the exact env vars to set on each platform.

**Verify:** on the live URL, in two different devices: login, chat, notifications, AI streaming and file upload all work. Check that SSE and AI streams aren't buffered by the host (text should arrive in pieces, not all at once).

### Step 7.4 – README and demo (about 2 h)

> Write README.md: one-line pitch, live demo link + demo login, a GIF placeholder, feature list grouped as Real-time / AI / Performance / Security, an architecture diagram in Mermaid, a "Why this technique" table (WebSockets for chat, SSE for notifications, HTTP streaming for AI), a link to PERFORMANCE.md with the 3 best numbers highlighted, key decisions with trade-offs, local setup in 3 commands, testing, and "What I'd do next" (RAG, WebRTC calls, OpenTelemetry). Keep it scannable.

Then record a 3–5 minute screen video: two-browser chat, notification toast, AI streaming with Stop, two-instance demo, and the performance table.

### Step 7.5 – Stretch (only if you have spare hours)

- [ ] Google OAuth login (the "Continue with Google" button already exists on /login and /register, disabled with a `soon` tag)
- [ ] Password reset: the "forgot?" link on /login (placeholder with a `soon` tag) → emailed one-time reset link, single-use and short-lived, revoke all refresh tokens on reset
- [ ] RAG: upload a PDF, chunk + embed it, store vectors in Atlas Vector Search, answer questions with citations
- [ ] 1:1 video call with WebRTC, using your Socket.IO server for signaling

### End of week

- [ ] Live URL works with the demo account
- [ ] CI green, README and PERFORMANCE.md complete
- [ ] Pinned on GitHub and linked on your resume and LinkedIn

## Working well with Claude Code, getting unstuck, and interview prep

The prompts above are starting points; how you steer Claude Code decides whether you finish in 7 days and whether you can defend the code afterwards.

### Prompting habits that save hours

- **One step per prompt.** If a prompt covers more than one step above, split it. Big prompts produce big, hard-to-review diffs.
- **Point at existing code.** "Follow the pattern in auth.controller.ts" keeps style consistent.
- **Ask for tests with the code**, then run them yourself. Don't accept "tests pass" without seeing it.
- **Say what not to do.** "Don't change the auth flow" or "don't add new dependencies" prevents scope creep.
- **Keep CLAUDE.md alive.** When you make a decision (e.g. "all socket events live in packages/shared/events.ts"), add it so tomorrow's session follows it.

### When you get stuck

1. Paste the exact error and the command you ran, and ask Claude Code to find the root cause before changing code.
2. If two fixes in a row fail, stop: `git diff` to see what changed, `git stash` or reset to your last good commit, and retry the step with a clearer prompt.
3. For real-time bugs, ask it to add temporary logging on both client and server for the event in question, then read the logs together.
4. If a day runs over, cut from that day's later steps, not from Day 6 or Day 7. Performance numbers and a live deploy matter more than one extra feature.

### Daily learning ritual (20 minutes, every evening)

- Pick the 2 most important files written today and explain them out loud without looking.
- Answer that day's "Learn" questions in NOTES.md in your own words.
- Ask Claude Code: "Ask me 5 interview questions about what we built today, one at a time, and grade my answers."

### Questions you should be able to answer by Day 7

- Walk me through what happens when a user sends a chat message.
- Why did you use WebSockets for chat, SSE for notifications and HTTP streaming for AI?
- How does your refresh-token rotation work, and what attack does it stop?
- How does your app work with two server instances?
- What was your biggest performance win, how did you measure it, and why did it work?
- How do you stop the AI feature from getting expensive or abused?
- What would break first with 100x more users, and what would you do about it?

Be open in interviews that you built this with an AI coding tool. Teams increasingly expect that; what they're testing is whether you understand, reviewed and can extend every part of it, which is exactly what this plan's verify-and-learn loop builds.