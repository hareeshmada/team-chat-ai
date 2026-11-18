# TeamChat AI – Learning Notes

Interview prep, built up step by step. Each topic has the same shape:

- **What**: the idea in one or two lines
- **Why**: the problem it solves
- **In this project**: where to see it in the code
- **Interview answer**: a short answer to say out loud
- **Gotcha**: the mistake people make

The **Learn** questions from `docs/PLAN.md` are marked 🎯. Each one has a
`✍️ In my own words:` line. Fill it in yourself without looking, because that's what the plan asks for.

## Contents
- [Day 0 – Scaffold and tooling](#day-0--scaffold-and-tooling)
- [Day 1 – Step 1.0 – Pre-flight check](#day-1--step-10--pre-flight-check)

---

## Day 0 – Scaffold and tooling

### npm workspaces (monorepo)
- **What:** One repo, several packages (`apps/client`, `apps/server`, `packages/shared`). One `npm install` at the root installs everything into one shared `node_modules`.
- **Why:** Client and server share code (Zod schemas, types) without publishing anything to npm.
- **In this project:** `"workspaces"` in the root `package.json`. `@teamchat/shared` is a **symlink**: `node_modules/@teamchat/shared → packages/shared`.
- **Interview answer:** "Workspaces link local packages with symlinks, so the apps import shared code like a normal npm package, and the dependency versions are resolved once for the whole repo."
- **Gotcha:** Run `npm install` from the **root**, not inside an app folder, or the links break.

### npm script flags
| Flag | Meaning |
|---|---|
| `-w @teamchat/server` | run in one workspace |
| `--workspaces` | run in all workspaces, in the listed order |
| `--if-present` | skip workspaces that don't have the script |
| `a && b` | run `b` only if `a` succeeded |

- **Why build shared first?** The apps import `packages/shared/dist`. If `dist` doesn't exist yet (fresh clone, CI), every import fails.

### `tsc` vs `tsx` / Vite (type-check vs transpile)
- **What:** `tsc` **checks types** and compiles. `tsx` and Vite (esbuild/Rolldown) only **strip** the types and run or bundle the code. They're very fast, but they ignore type errors.
- **Why:** Fast feedback in dev, strict safety in CI.
- **In this project:** dev uses `tsx watch` and `vite`. The `typecheck` script uses `tsc --noEmit`. The client `build` runs `tsc --noEmit && vite build`.
- **Interview answer:** "Dev tools only strip types for speed, so type safety comes from a separate `tsc --noEmit` step in CI and in the build."
- **Gotcha:** "It runs in dev" doesn't mean "it type-checks."

### Production: compile, then run plain Node
- `npm run build` → `node dist/server.js`. No TypeScript tooling runs in production: it starts faster, uses less memory, and type errors fail the build instead of failing at runtime.

### ESLint vs Prettier
- **ESLint** = code **quality** (unused variables, hook rules, bugs). **Prettier** = **formatting** (quotes, commas, line width).
- `eslint-config-prettier` turns off the ESLint style rules so the two tools never fight.
- `format:check` is for CI (it fails on unformatted code); `format` is for local use (it rewrites files).

### `.gitignore` only affects untracked files
- **What:** Git ignores matching files **only if they aren't tracked yet**.
- **Gotcha:** If `node_modules` was already committed, adding it to `.gitignore` does nothing. Fix it with:
  ```bash
  git rm -r --cached node_modules   # stop tracking it, keep the files on disk
  ```
- `node_modules/` without a leading `/` matches at **any depth** (`apps/server/node_modules` too).
- Commit `.env.example` (the template); never commit `.env` (real secrets).
- Check what git would do: `git check-ignore -v <path>`, `git add -A --dry-run`.

### Validate env vars at startup (fail fast)
- **What:** `config/env.ts` parses `process.env` with Zod. If anything is missing or wrong, the process exits right away with a clear message.
- **Why:** You find a bad config at boot, not 3 hours later when the first user hits the code path that needs it.
- **Gotcha:** Print the **names** of bad keys, never their **values** (they may be secrets).

### Node.js release lines (LTS)
- Even-numbered versions become LTS. Each line moves through Current → Active LTS → Maintenance → **End-of-life**.
- Node 20 reached EOL in April 2026 (no more security fixes), so we moved to **Node 24 LTS**.
- `.nvmrc` pins the version (`nvm use`); `engines` in `package.json` documents and warns about it.

### Version notes we hit
- **Express 5:** a rejected promise in an async handler goes to the error handler automatically, so there's no need for `express-async-errors` or `try/catch` wrappers.
- **Zod 4:** `z.url()`, `z.email()`, `z.iso.datetime()`, `z.prettifyError()` (the v3 style `z.string().url()` is deprecated).
- **TypeScript 6:** no longer loads every `@types/*` automatically, so set `"types": [...]` in each tsconfig.
- **NodeNext ESM:** relative imports need `.js` (`import { x } from './app.js'`), even in `.ts` files.
- **React 19:** `useOptimistic` (show a sent message instantly), Actions and `useActionState` (form pending and error state), `ref` as a normal prop (no `forwardRef`), `use()`.

---

## Day 1 – Step 1.0 – Pre-flight check

### 🎯 Why separate `app.ts` from `server.ts`?
- **What:** `app.ts` **builds** the Express app and exports it. `server.ts` **starts** it: connects to the DB, calls `listen()`, handles shutdown.
- **Why:**
  1. **Testing:** Supertest takes the app object directly (`request(createApp())`). No port, no real server, no "address already in use", and tests can run in parallel.
  2. **Side effects live in one place:** importing `app.ts` doesn't open sockets or DB connections.
  3. **Reuse:** the same app can later be attached to Socket.IO, run in a worker, or be wrapped by another server.
- **In this project:** `apps/server/src/app.ts` (`createApp()`), `apps/server/src/server.ts` (top-level `await connectDb()` → `listen`).
- **Interview answer:** "The app is a pure factory, so tests can import it without side effects. Starting it (DB, port, signals) is a separate entry point that only runs in real environments."
- **Gotcha:** If `app.ts` calls `listen()`, every test file opens a real port and tests clash.

✍️ In my own words:

### 🎯 Why does a dev proxy remove cookie and CORS problems?
- **What:** The browser only talks to `localhost:5173` (Vite). Vite forwards `/api/*` and `/socket.io/*` to `localhost:4000` behind the scenes.
- **Why:**
  - **CORS:** the browser enforces CORS only when the page origin and the request origin differ. With the proxy, they're the **same origin**, so there's no preflight, no `Access-Control-*` headers and nothing to debug.
  - **Cookies:** cross-origin cookies need `SameSite=None; Secure` plus `credentials: 'include'`, which is painful on http://localhost. Same-origin cookies **just work**, and that matters for our refresh-token cookie in Step 1.2.
  - **Matches production:** in prod, Nginx serves the client and the API from one domain. The dev setup now behaves the same way.
- **In this project:** `apps/client/vite.config.ts` → `server.proxy`. `ws: true` also forwards WebSocket upgrades (needed for Socket.IO). Client calls use relative URLs (`VITE_API_URL=/api`).
- **Interview answer:** "CORS and SameSite are browser rules about *cross-origin* requests. A proxy makes the API look like it's on the same origin as the page, so those rules never apply, and it mirrors the single-domain production setup."
- **Gotcha:** The proxy is **dev only**. Production needs a real reverse proxy (Nginx) or proper CORS settings.

✍️ In my own words:

### Shared Zod schemas = one source of truth
- **What:** `healthResponseSchema` lives in `packages/shared`. The server uses it for the response type; the client (and tests) can use it to **validate at runtime**.
- **Why:** TypeScript types disappear at runtime. A Zod schema gives you **both** a type (`z.infer`) and a runtime check, defined once, so client and server can't drift apart.
- **Gotcha: one Zod version.** If client, server and shared each had a different Zod copy, schemas built with one copy could misbehave in another (`instanceof` checks fail). Check with `npm ls zod`: every entry should be `deduped` to one version.

### Tree-shaking (why the client check needed real usage)
- **What:** Bundlers (Vite) **drop code that nothing uses**.
- **Why it mattered:** Importing a schema without using it would have been removed from the production bundle, so a "build passed" result wouldn't prove the import works. The temporary check had to actually call `.parse()`.
- **Interview answer:** "Tree-shaking removes unused exports from ES modules at build time. It keeps bundles small, and it's why named ESM exports beat `export default { … }` objects."

### Mongoose connection details
- **No db name in the URI → Mongoose uses a database called `test`.** We pass `dbName` from `MONGODB_DB_NAME` (`teamchatai`).
- **Model → collection naming:** the model `Team` maps to the collection `teams` (lowercased and pluralised), so your existing Atlas `teams` collection will be reused.
- **Never log the connection string.** It contains the password, so we log only `host` and `db`.
- **Connect before listen:** if the DB is down, fail at startup instead of accepting requests that will all fail.

### Graceful shutdown
- **What:** On `SIGINT` (Ctrl+C) / `SIGTERM` (Docker, Kubernetes, deploys): stop accepting new HTTP connections (`server.close()`), close the DB connection, then exit.
- **Why:** In-flight requests finish, there are no half-written DB operations and no dropped connections during deploys.
- **Order matters:** close HTTP **first**, then the DB, because open requests may still need the DB.

### Testing with mongodb-memory-server
- **What:** Starts a real `mongod` in memory for the test run. It's fast, it gives a fresh DB on every run, and it never touches Atlas.
- **How it's wired:**
  - `test/globalSetup.ts`: runs **once** in the main Vitest process → starts mongod → `provide('mongoUri', uri)`.
  - `test/setup.ts`: runs **before every test file** → `inject('mongoUri')` into `process.env` *before* `env.ts` is imported → connect, then `afterEach` empties all collections, then `afterAll` disconnects.
- **Why empty collections after each test:** tests must be **independent**. One test's data must never make another pass or fail (order-dependent tests are flaky).
- **Interview answer:** "Integration tests run against a real but disposable in-memory Mongo. Each test starts from a clean state, so tests are isolated, repeatable and need no external services or secrets."
- **Gotcha:** `provide`/`inject` is how you pass data from global setup to test workers. Workers run in separate processes/threads, so a module variable set in globalSetup isn't visible to them.

### npm 11 install-script approval
- npm 11 doesn't run package `postinstall` scripts until you approve them (`npm install-scripts ls` / `approve`). This is a supply-chain safety feature: install scripts can run any code.
- We left esbuild and mongodb-memory-server unapproved; both work without their scripts (the mongod binary downloads on the first test run).

### Same-origin API routes
- Every API router is mounted under `/api` so the dev proxy (and Nginx later) can route by path. `/health` also stays at the root for infra probes (load balancers, Docker healthchecks).
