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
- [Day 1 – Step 1.1 – Server foundation](#day-1--step-11--server-foundation)

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
→ Covered in full under [Step 1.1 🎯 Why validate env vars at startup?](#-why-validate-env-vars-at-startup).

### Node.js release lines (LTS)
- Even-numbered versions become LTS. Each line moves through Current → Active LTS → Maintenance → **End-of-life**.
- Node 20 reached EOL in April 2026 (no more security fixes), so we moved to **Node 24 LTS**.
- `.nvmrc` pins the version (`nvm use`); `engines` in `package.json` documents and warns about it.

### Version notes we hit
- **Express 5:** a rejected promise in an async handler goes to the error handler automatically, so there's no need for `express-async-errors` or `try/catch` wrappers.
- **Express 5:** `req.query` is a read-only getter, and the `app.listen` callback also receives listen errors. Both are covered in Step 1.1.
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
- **URI anatomy:** `mongodb+srv://<user>:<password>@<host>/<databaseName>?<options>`. The db name is the **path**, and it's optional. Atlas's copied string has an empty path (`.mongodb.net/?retryWrites=...`).
- **No db name in the URI → Mongoose uses a database called `test`.** We pass `dbName` from `MONGODB_DB_NAME` (`teamchatai`).
- **Precedence:** `mongoose.connect(uri, { dbName })`: the `dbName` option **overrides** the URI path. Keeping it in a separate env var makes it easy to switch DBs and safe to log; the URI can't be logged because it holds the password.
- **Adding it to the URI:** insert it between `/` and `?` → `...mongodb.net/teamchatai?retryWrites=true`. Special characters in the password (`@ : / ? # %`) must be URL-encoded (`@` → `%40`).
- **Gotcha – authSource:** with plain `mongodb://`, the path db is also the **auth database** unless `?authSource=admin` is set, so a user created in `admin` fails to log in. Atlas `mongodb+srv://` sets `authSource=admin` through DNS TXT records, so adding the path is safe there.
- **Model → collection naming:** the model `Team` maps to the collection `teams` (lowercased and pluralised), so your existing Atlas `teams` collection will be reused.
- **Never log the connection string.** It contains the password, so we log only `host` and `db`.
- **Connect before listen:** if the DB is down, fail at startup instead of accepting requests that will all fail.

### Graceful shutdown
→ Covered in full under [Step 1.1 🎯 What does graceful shutdown protect against?](#-what-does-graceful-shutdown-protect-against).

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

---

## Day 1 – Step 1.1 – Server foundation

### 🎯 Why validate env vars at startup?
- **What:** `config/env.ts` parses `process.env` with a Zod schema the moment the server starts. If anything is missing or malformed, it prints which key is wrong and exits with code 1.
- **Why:**
  - **Fail fast:** a bad config shows up at boot (in the deploy logs, before traffic arrives), not hours later when the first user hits the code path that needs it.
  - **One place:** every setting, with its type and default, is listed in one file.
  - **Typed config:** `env.PORT` is a `number`, not a `string | undefined`, because Zod coerces it, so the rest of the code never re-checks.
- **In this project:** `MONGODB_URI=foo` → `✖ MONGODB_URI must start with mongodb:// or mongodb+srv://` and exit 1, before any DB connection is even attempted.
- **Interview answer:** "Config errors are the cheapest bugs to catch and the most expensive to find late. Validating env at startup turns a runtime surprise into a deploy-time failure, and gives the rest of the app a typed, trusted config object."
- **Gotcha:** Print the **names** of bad keys, never their **values** (they may be secrets).

✍️ In my own words:

### 🎯 What does graceful shutdown protect against?
- **What:** On `SIGINT` (Ctrl+C) or `SIGTERM` (sent by Docker, Kubernetes and deploy tools before they kill a container):
  1. `server.close()`: stop accepting new connections and let in-flight requests finish;
  2. `server.closeIdleConnections()`: drop idle keep-alive sockets, which would otherwise keep `close()` waiting;
  3. then `disconnectDb()`;
  4. `exit(0)`.
  A 10-second timer forces `exit(1)` if anything hangs, and a `shuttingDown` flag ignores a second Ctrl+C.
- **Protects against:**
  - users getting **connection reset / 502** errors during every deploy;
  - **half-done work**, e.g. a message saved to the DB but its socket broadcast never sent;
  - the DB closing **under** a running request (that's why HTTP closes first, DB second);
  - **hanging forever** on a stuck connection, so the orchestrator has to `SIGKILL` it (the force-exit timer prevents that).
- **In this project:** `apps/server/src/server.ts` → `shutdown()`.
- **Interview answer:** "Deploys and autoscaling stop processes all the time. Graceful shutdown drains in-flight requests, then closes resources in dependency order, with a timeout as a safety net, so stopping a process never drops user requests or corrupts work."
- **Gotcha:** Docker sends `SIGTERM`, then `SIGKILL` after 10s by default, so your own timeout must be **shorter** than the orchestrator's.

✍️ In my own words:

### Request ids (correlation ids) with pino-http
- **What:** Every request gets an id (`reqId`). pino-http attaches it to `req.log`, so **every log line written during that request** carries it. It's also sent back as the `X-Request-Id` response header.
- **Why:** With many concurrent requests, log lines interleave. Filtering by `reqId` shows the whole story of one request. A user or client can quote the header in a bug report.
- **In this project:** `middleware/requestLogger.ts`:
  - reuses an incoming `X-Request-Id` (e.g. one set by Nginx or a load balancer), but **only if it matches `^[\w-]{1,64}$`**, otherwise a client could inject fake log content;
  - otherwise generates `crypto.randomUUID()`;
  - `quietReqLogger: true` → `req.log` binds only `reqId`, not the whole request object on every line;
  - log level by outcome: 2xx/3xx → info, 4xx → warn, 5xx → error.
- **Interview answer:** "A correlation id ties together all logs for one request, and, once you pass it on to other services, across services too. It's the cheapest form of distributed tracing."
- **Gotcha:** Register the request logger **first**, so 404s and errors also get an id.

### Logging redaction
- Pino's `redact` replaces `authorization`, `cookie`, `set-cookie`, `*.password` and `*.token` with `[REDACTED]` **before** the line is written. We verified it: we sent `Cookie: refresh=SECRET`, and the log shows `"cookie":"[REDACTED]"`.
- **Why:** Logs get shipped to third-party tools and read by many people. A leaked token in a log is a leaked session.

### One error format and the central error handler
- **What:** Every error response has the same shape: `{ error: { code, message, details? } }`. Clients switch on `code` (stable) and show `message` (human-readable).
- **How errors map:**

| Source | Status / code |
|---|---|
| `throw new AppError(404, 'NOT_FOUND', …)` | as given |
| `validate()` failure | 400 `VALIDATION_ERROR` + `details` |
| malformed JSON body | 400 `INVALID_JSON` (was wrongly 500 before this step) |
| body over 100kb | 413 `PAYLOAD_TOO_LARGE` |
| anything else | 500 `INTERNAL_ERROR` |

- **Why hide stack traces in production:** a stack trace reveals file paths, library names and versions, which is a map for an attacker. So production gets only `"Internal server error"`; dev and test also get `stack` to speed up debugging. The real error still goes to the logs, with `reqId`.
- **Gotcha:** For unexpected errors we set `res.err` and let pino-http log it **once** in its "request errored" line. Logging in the handler too would give two lines per error.

### `validate()` middleware and the Express 5 `req.query` gotcha
- **What:** `validate({ params, query, body })` runs Zod on each part, collects **all** problems into one 400 (`details: [{ location, path, message }]`), and on success **replaces** each part with the parsed value: strings coerced to numbers, defaults applied, unknown keys stripped (`isAdmin: true` disappears).
- **Why replace?** Controllers then work with clean, typed data. Stripping unknown keys blocks **mass assignment** (a client sending `role: 'admin'` that ends up in `Model.create(req.body)`).
- **Express 5 gotcha:** `req.query` is a **getter** on the request prototype; it re-parses the URL every time you read it. `req.query = parsed` silently does nothing (or throws in strict mode). Fix: `Object.defineProperty(req, 'query', { value: parsed, … })` creates an own property on that request that shadows the getter.
- **Interview answer:** "Validate at the edge, then trust the data inside. Zod gives runtime validation and the TypeScript type from one schema, and replacing the input with the parsed output means coercion, defaults and stripping all happen in one place."

### Retry with exponential backoff, but only for transient errors
- **What:** `connectDb()` tries up to 5 times, waiting 1s → 2s → 4s → 8s between attempts (each wait doubles).
- **Transient** errors (network down, DNS hiccup, cluster still starting: `MongooseServerSelectionError`, `ECONNREFUSED`, …) are **retried**. **Permanent** errors (bad URI, wrong password) **fail fast**, because retrying can't fix them and would only delay the error message.
- **Why backoff instead of a fixed delay:** it gives a struggling service room to recover instead of hammering it. In big systems you also add **jitter** (a random ± delay) so 100 instances don't all retry at the same moment ("thundering herd").
- **In this project:** an unreachable DB → 4 warning lines, then `Could not connect to MongoDB after 5 attempts` and exit 1 after about 40s. `serverSelectionTimeoutMS: 5000` stops each attempt from hanging for the 30s default.
- **Gotcha:** The tests call `connectDb(..., { baseDelayMs: 1 })` so retry tests take milliseconds, not 15 seconds. Making delays injectable is what makes them testable.

### Express 5: `app.listen` callback receives errors
- **What:** In Express 5, `app.listen(port, cb)` also calls `cb(err)` when listening **fails** (e.g. `EADDRINUSE`, port already taken).
- **The bug we hit:** our callback ignored its argument, so with port 4000 already taken the server logged "listening on :4000" while not listening at all.
- **Fix:** `listen(port, (err) => { if (err) { log fatal; disconnect DB; exit(1) } … })`.
- **Lesson:** when upgrading a major version, read the migration guide for **changed callback signatures**. They don't break the type check (the parameter is optional), they just quietly change behaviour.

### helmet and cookie-parser
- **helmet** sets security headers in one line:
  - `X-Content-Type-Options: nosniff`: the browser won't guess file types (stops some XSS tricks);
  - `Content-Security-Policy`: limits where scripts and styles may load from;
  - `X-Frame-Options` / `frame-ancestors`: blocks clickjacking through iframes;
  - `Strict-Transport-Security`: tells the browser "HTTPS only from now on".
  We also `app.disable('x-powered-by')`, so we don't advertise "Express".
- **cookie-parser** turns the raw `Cookie` header into `req.cookies`. We need it in Step 1.2 to read the httpOnly refresh-token cookie.

### Middleware order matters
`requestLogger → helmet → cors → express.json → cookieParser → routes → notFound → errorHandler`
- The logger goes **first** so everything gets a `reqId`.
- Security headers and CORS run **before** any route.
- Body parsers run **before** routes that read `req.body`.
- `notFound` comes **after** all routes (it catches whatever nothing else matched).
- `errorHandler` goes **last** and has 4 parameters `(err, req, res, next)`; that signature is how Express knows it's an error handler.

### Testing middleware with a mini app
- `validate.test.ts` and `errorHandler.test.ts` build a tiny `express()` app with only the piece under test plus `errorHandler`.
- **Why:** you can test edge cases (a route that throws, a strict schema) **without adding fake endpoints to the real app**.
- To test production-only behaviour, the test temporarily sets `env.NODE_ENV = 'production'` and restores it in `afterEach`.
