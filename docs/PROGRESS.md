# Progress

Current step: Day 1 – Step 1.2
Last completed: Day 1 – Step 1.1 (server foundation)

## Decisions / deviations from PLAN.md
- MongoDB: Atlas (Mumbai region), env var MONGODB_URI. Compose runs Redis only.
- Packages updated to latest stable (see package.json): React 19, Node 24 LTS, TS 6, Vite 8, Express 5, Zod 4, Mongoose 9.
- MONGODB_DB_NAME (`teamchatai`, set in apps/server/.env) selects the database; the Atlas URI has no db name in its path (Mongoose would otherwise use `test`).
- Health is served at both `/health` (infra probes) and `/api/health` (through the Vite proxy, as Step 1.0 Verify expects).
- Server tests use mongodb-memory-server (db `teamchat-test`); they never touch Atlas.
- npm 11 install scripts for esbuild and mongodb-memory-server are left unapproved; neither is required (mongod binary downloads on first test run).
- Step 1.1: the error format is `{ error: { code, message, details? } }`. `details` is added (an optional 4th AppError arg) for validation issues.
- Step 1.1: `validate()` returns a plain RequestHandler; controllers type their request with `z.infer` of the same schema (simpler than generic handler types with Express route typing).
- Step 1.1: DB connect retries 5× with exponential backoff (1s→8s), only for transient errors; bad URI or auth errors fail fast.

## Known issues / TODO
- `npm audit`: high-severity ReDoS in `picomatch`, pulled in only by dev tooling (typescript-eslint, Vite toolchain). The suggested `npm audit fix --force` would downgrade Vite 8 → 6, so it's not applied. Re-check when typescript-eslint/Vite release an update.
- WebSocket upgrade through the /socket.io proxy reaches the server, but a full WS handshake can only be tested once Socket.IO is added in Step 2.2.
