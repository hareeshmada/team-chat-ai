# Progress

Current step: Day 1 – Step 1.1
Last completed: Day 1 – Step 1.0 (pre-flight check of the scaffold)

## Decisions / deviations from PLAN.md
- MongoDB: Atlas (Mumbai region), env var MONGODB_URI. Compose runs Redis only.
- Packages updated to latest stable (see package.json): React 19, Node 24 LTS, TS 6, Vite 8, Express 5, Zod 4, Mongoose 9.
- MONGODB_DB_NAME (default `teamchatai`) selects the database, because the Atlas URI has no db name in its path (Mongoose would otherwise use `test`).
- Health is served at both `/health` (infra probes) and `/api/health` (through the Vite proxy, as Step 1.0 Verify expects).
- Server tests use mongodb-memory-server (db `teamchat-test`); they never touch Atlas.
- npm 11 install scripts for esbuild and mongodb-memory-server are left unapproved; neither is required (mongod binary downloads on first test run).

## Known issues / TODO
- Step 1.1 overlap: env.ts (Zod), Pino logger, AppError, central error handler, 404 handler, cors, express.json 100kb and graceful shutdown already exist. Step 1.1 only needs to add: Mongo connect retry, pino-http request ids, hiding stack traces in production, validate(schema) middleware, helmet, cookie-parser, and the validation-error test.
- WebSocket upgrade through the /socket.io proxy is confirmed to reach the server (server answers the upgrade request), but a full WS handshake can only be tested once Socket.IO is added in Step 2.2.
