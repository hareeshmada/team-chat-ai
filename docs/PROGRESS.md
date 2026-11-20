# Progress

Current step: Day 1 – Step 1.3
Last completed: Day 1 – Step 1.2b (design foundation: theme, fonts, base UI components)

## Decisions / deviations from PLAN.md
- MongoDB: Atlas (Mumbai region), env var MONGODB_URI. Compose runs Redis only.
- Packages updated to latest stable (see package.json): React 19, Node 24 LTS, TS 6, Vite 8, Express 5, Zod 4, Mongoose 9.
- MONGODB_DB_NAME (`teamchatai`, set in apps/server/.env) selects the database; the Atlas URI has no db name in its path (Mongoose would otherwise use `test`).
- Health is served at both `/health` (infra probes) and `/api/health` (through the Vite proxy, as Step 1.0 Verify expects).
- Server tests use mongodb-memory-server, one database per Vitest worker (`teamchat-test-<poolId>`); they never touch Atlas.
- npm 11 install scripts for esbuild and mongodb-memory-server are left unapproved; neither is required (mongod binary downloads on first test run).
- Step 1.1: the error format is `{ error: { code, message, details? } }`. `details` is added (an optional 4th AppError arg) for validation issues.
- Step 1.1: `validate()` returns a plain RequestHandler; controllers type their request with `z.infer` of the same schema.
- Step 1.1: DB connect retries 5× with exponential backoff (1s→8s), only for transient errors; bad URI or auth errors fail fast.
- Step 1.2: JWT library is `jsonwebtoken` 9 (HS256 pinned on verify). bcrypt cost 12 (4 in tests for speed).
- Step 1.2: access token TTL is configurable (`ACCESS_TOKEN_TTL_SECONDS`, default 900), so Step 1.3 can shorten it to 30s for its Verify.
- Step 1.2: `/refresh` returns `{ accessToken }` only; `/me` returns `{ user }`. Login/register return `{ accessToken, user }`.
- Step 1.2: register reveals an existing email (409 `EMAIL_TAKEN`); login does not (same 401 + timing-safe dummy compare).
- Step 1.2: in the grace window, a second refresh issues a sibling token in the same family (the browser keeps whichever cookie arrives last).
- Step 1.2 QA fixes: the password limit is 72 UTF-8 **bytes** (not characters); `Bearer` is matched case-insensitively; a refresh with an already-ended session (logout or earlier theft kill) returns `INVALID_REFRESH_TOKEN`, and `REFRESH_TOKEN_REUSED` is only returned once, when theft is first detected.
- Step 1.2b: DESIGN.md tokens extended with `field`, `on-danger`, `focus-ring` (per-theme values are tokens, not `dark:` overrides, so nested `data-theme` works). Font families use the `@fontsource-variable` names ("Inter Variable", "JetBrains Mono Variable"). Tag text is `fg`; StatusDot has a 4th `live` (accent) variant.
- Step 1.2b: `/dev/ui` is a pathname check in App.tsx (React Router comes in Step 1.3); lazy-loaded behind `import.meta.env.DEV`, so it is not in the production bundle. No tailwind-merge: a small `cn()` joins classes.

## Known issues / TODO
- Day 7 (Nginx/deploy): set `app.set('trust proxy', 1)`, otherwise the rate limiter sees the proxy's IP for every user.
- Day 7: consider `autoIndex: false` in production and creating indexes during deploy instead.
- Day 7 (Nginx/CSP): index.html has an inline theme script; a Content-Security-Policy needs its sha256 hash in `script-src` (or move to a nonce).
- WebSocket upgrade through the /socket.io proxy reaches the server, but a full WS handshake can only be tested once Socket.IO is added in Step 2.2.
