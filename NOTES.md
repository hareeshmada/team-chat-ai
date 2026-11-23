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
- [Day 1 – Step 1.2 – Auth concepts (before coding)](#day-1--step-12--auth-concepts-before-coding)
- [Day 1 – Step 1.2 – Auth implementation lessons](#day-1--step-12--auth-implementation-lessons)
- [Day 1 – Step 1.2b – Design foundation (themes, tokens, components)](#day-1--step-12b--design-foundation-themes-tokens-components)
- [Day 1 – Step 1.3 – Client auth (router, api client, silent refresh)](#day-1--step-13--client-auth-router-api-client-silent-refresh)
- [Day 2 – Step 2.1 – Access control concepts (before coding)](#day-2--step-21--access-control-concepts-before-coding)
- [Day 2 – Step 2.1 – Workspaces, channels and pagination](#day-2--step-21--workspaces-channels-and-pagination)
- [Day 2 – Step 2.1 – Architecture diagrams (roles, workspaces, channels, members)](#day-2--step-21--architecture-diagrams-roles-workspaces-channels-members)
- [Day 2 – Step 2.2 – Socket.IO server (rooms, acks, presence)](#day-2--step-22--socketio-server-rooms-acks-presence)

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
- **Gotcha (Step 2.1):** a new terminal uses nvm's *default* version (it was Node 22), not `.nvmrc`. `npm test` ran on Node 22, and 2 tests timed out; with `nvm use` (Node 24) all passed. `engines` only **warns**, and only during `npm install`; it doesn't stop `npm test`. Fix it once with `nvm alias default 24`, and check `node -v` when something works for one person and not another.

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

---

## Day 1 – Step 1.2 – Auth concepts (before coding)

### Access token vs refresh token
- **The problem with one token:** if it lasts **7 days**, a stolen token gives an attacker 7 days of access, and a JWT can't easily be cancelled (logout doesn't kill it). If it lasts **15 minutes**, the user has to log in again every 15 minutes. One token can't be both safe and convenient.

| | **Access token** (short-lived) | **Refresh token** (long-lived) |
|---|---|---|
| Lifetime | **15 min** | **7 days** |
| Purpose | Proves "I'm user X" on **every API call** | Its only use is getting a **new access token** |
| Format | **JWT**, signed, payload only `{ sub: userId }` | **Opaque random string** (`crypto.randomBytes(48)`) |
| Server check | Signature only, **no DB lookup** (fast) | **DB lookup** (so it can be revoked) |
| Client storage | **In memory** (Zustand), never localStorage | **httpOnly cookie** (JS can't read it) |
| Sent | `Authorization: Bearer <jwt>` on every request | By the browser, **only** to `/api/auth/*` |

- **Analogy:** access token = a **day pass** the guard checks at a glance; refresh token = your **ID card**, locked in a drawer, shown only at the front desk to get a new day pass, and the front desk can cancel it.
- **Interview answer:** "Short-lived access tokens give fast, stateless auth on every request. The long-lived refresh token gives a good user experience and a point where the session can be revoked, because it's checked against the database."

### The flow: when each token is used
```
1. LOGIN        POST /api/auth/login → body: accessToken (15 min) + user
                                        cookie: refresh (httpOnly, 7 days, Path=/api/auth)
2. API CALLS    Authorization: Bearer <access> → JWT verified, no DB hit
                (the refresh cookie is NOT sent: its path is /api/auth)
3. EXPIRY       401 → client calls POST /api/auth/refresh (cookie attached automatically)
                → new access token + new refresh cookie (rotation) → retry the request
4. PAGE RELOAD  in-memory access token is lost → call /refresh on load → still logged in
5. LOGOUT       POST /api/auth/logout → refresh family revoked in DB, cookie cleared
                (the old access token still works for ≤15 min, an accepted trade-off)
```

### What if the attacker steals one of them?
The two-token design doesn't make a stolen token harmless. It **splits the risk**: the token that travels the most dies quickly, and the token that lives long is hard to steal and **detected** if stolen.

**Stolen access token** (easiest to leak, since it's sent with every request: logs, proxies, a malicious script):
- The attacker can act as the user for **≤ 15 min**.
- They **can't renew it**: that needs the refresh token, which is in an httpOnly cookie.
```
t=0     stolen  →  t=0–15 attacker can call the API  →  t=15 expires, 401, the attacker is done
```

**Stolen refresh token.** First, it's hard to steal:

| Layer | Blocks |
|---|---|
| `httpOnly` | Scripts reading it (`document.cookie` doesn't show it) |
| `Secure` | Network sniffing (HTTPS only) |
| `SameSite=Strict` | Other sites making the browser send it (CSRF) |
| `Path=/api/auth` | Being sent with every request, so fewer chances to leak |
| SHA-256 hash in DB | A database leak (hashes are useless to the attacker) |

If it's stolen anyway (malware, someone using the laptop), **rotation** makes it single-use, so the user and the attacker hold the *same* token and only one of them can use it:
```
2a. Attacker first:  attacker A → gets B'  (A marked used)
                     user's access expires → user sends A → "A already used!"
                     → revoke WHOLE family (B' too) → 401 → user logs in again. Theft detected.

2b. User first:      user A → gets B (A marked used)
                     attacker sends A → "already used" → revoke family → attacker gets nothing.
```
The attacker's window lasts until the user's next refresh (~every 15 min while active).

**Honest limits** (interviewers like these):
1. **Victim offline:** if the user never refreshes (laptop closed for days), reuse is never detected. *Mitigations:* an absolute session limit (e.g. log in again after 30 days), "log out of all devices", and revoking all sessions on password change.
2. **XSS while the page is open:** a script can't *read* the refresh cookie, but it can *make requests from the page*, and the browser attaches the cookie. httpOnly stops **theft for later**, not abuse in the moment. *Real defense:* prevent XSS (React escaping, the helmet CSP).
3. **Both tokens stolen / device compromised:** no token design survives that. Limit the damage with detection, session limits and asking for the password again before sensitive actions.
4. **Logout isn't instant** for the access token (≤ 15 min). If you need it instant, add a Redis denylist.

| Stolen | Hard to steal? | Damage window | Detected? |
|---|---|---|---|
| Access token | Easier | **≤ 15 min**, can't renew | No, it just expires |
| Refresh token | Hard (5 layers) | Until the victim's next refresh | **Yes**: reuse revokes the family |
| Single 7-day JWT | Easy | **7 days** | **Never** |

- **Interview answer:** "The two tokens split the risk. The access token is the most exposed, so it's short-lived and can't renew itself. The refresh token is long-lived but rarely sent and locked in an httpOnly, SameSite cookie. Because it's single-use, a stolen copy is detected as soon as both parties use it, and the whole session is revoked. The system limits damage from the easy-to-steal token and detects theft of the hard-to-steal one."

### Refresh-token rotation, families and the grace window
- **Rotation:** every `/refresh` revokes the old token (`revokedAt`, `replacedBy`) and issues a new one.
- **Family:** all tokens descended from one login share a `family` id, so reuse detection can revoke the **whole chain** at once. Logout also revokes the family.
- **10-second grace window:** two tabs may refresh with the same token at the same moment. One wins; the other looks like reuse. Reuse **within 10s of rotation** counts as a race, not an attack, so the user isn't logged out.
- **TTL index** on `expiresAt`: MongoDB deletes expired tokens automatically, so no cleanup job is needed.

### Other auth rules in this step
| Rule | Why |
|---|---|
| Refresh token stored as a **SHA-256 hash** | A DB leak gives useless hashes. SHA-256 (fast) is fine because 48 random bytes can't be guessed; passwords need slow bcrypt because humans pick guessable ones. |
| Refresh token is **opaque**, not a JWT | It's looked up in the DB anyway, so a JWT adds nothing. Opaque = no readable data, and it can't be checked without the server. |
| Access token **in memory**, not localStorage | Any injected script can read localStorage. Memory is lost on reload, and `/refresh` restores it. |
| Same **"Invalid email or password"** for both cases | Prevents **user enumeration** (probing which emails are registered). |
| **bcrypt, 12 rounds** | Deliberately slow (~250ms per hash), so brute-forcing a leaked password DB is expensive. |
| **Rate limit 10/min per IP** on login/register | Slows down password guessing. Disabled in tests. |
| **`SameSite`** from `COOKIE_SAMESITE` (default `strict`) | Strict blocks CSRF. It works because the dev proxy makes everything same-origin (Step 1.0). |

### 🎯 Why store the refresh token as a hash?
✍️ In my own words:

### 🎯 Why httpOnly cookie for refresh but not for access?
✍️ In my own words:

### 🎯 What attack does rotation with reuse detection stop?
✍️ In my own words:

### 🎯 Why is the refresh token an opaque random string and not a JWT?
✍️ In my own words:

---

## Day 1 – Step 1.2 – Auth implementation lessons

### Where the code lives
`routes/auth.routes.ts` → `controllers/auth.controller.ts` (HTTP only: cookies, status codes) → `services/auth.service.ts` (all logic + DB) → `models/User.ts`, `models/RefreshToken.ts`. Token helpers: `services/token.service.ts`; cookie options: `lib/refreshCookie.ts`; auth guard: `middleware/requireAuth.ts`. The request schemas come from `packages/shared` (`registerSchema`, `loginSchema`), so the client form in Step 1.3 uses the exact same rules.

### Timing-safe login (user enumeration through timing)
- **What:** for an unknown email we still run `bcrypt.compare` against a dummy hash.
- **Why:** the same error *message* isn't enough. Without the dummy compare, "no such user" answers in ~5 ms and "wrong password" in ~250 ms (bcrypt), so an attacker can tell which emails are registered just by timing the responses.
- **Interview answer:** "Both failure paths must look identical: the same status, the same body **and** roughly the same time."
- **Honest note:** `/register` returns 409 `EMAIL_TAKEN`, which does reveal that an email exists. Most apps accept that trade-off for usability; the rate limit makes mass probing slow.

### Atomic rotation (race conditions in refresh)
- **Problem:** two requests with the same refresh token arrive together. Both read "not revoked", and both rotate → two valid successor tokens.
- **Fix:** `findOneAndUpdate({ _id, revokedAt: null }, { revokedAt: now, replacedBy })`. MongoDB applies the filter and the update as **one atomic operation**, so only one request can flip `revokedAt` from null. The loser sees "already revoked" and goes through the grace-window check.
- **Interview answer:** "Check-then-act in two queries is a race. Put the condition **inside** the update so the database enforces it atomically."

### Grace window vs killed sessions (a subtle bug we avoided)
- `replacedBy` tells us **why** a token is revoked: set means *rotated* (a normal refresh); `null` + `revokedAt` means *killed* (logout or reuse detected).
- The grace window only applies to *rotated* tokens, and only while the family has no killed token. Otherwise "log out, then within 10 seconds replay the previous token" would bring a logged-out session back to life. There's a test for exactly this.
- **Error codes (bug found in QA):** the first version answered `REFRESH_TOKEN_REUSED` ("already used") for a token that was simply **logged out**. That's a misleading message and would cause false "theft" alerts in monitoring. Now:
  - session already ended (logout, or theft detected earlier) → `INVALID_REFRESH_TOKEN`
  - a *rotated* token replayed after the grace window → `REFRESH_TOKEN_REUSED`, reported **once**, at the moment of detection.
- **Lesson:** error codes are an API contract. Clients and alerting branch on them, so each code must mean exactly one thing.

### JWT pitfalls
- **Pin the algorithm:** `jwt.verify(token, secret, { algorithms: ['HS256'] })`. Never let the token's own header decide how it's verified. The classic attacks are `alg: none` (no signature at all) and RS256→HS256 confusion. There's a test that an `alg: none` token is rejected.
- **Keep the payload minimal** (`sub` + `iat`/`exp`): a JWT is **signed, not encrypted**, so anyone can base64-decode and read it.
- **Distinguish `TOKEN_EXPIRED` from `INVALID_TOKEN`:** the client refreshes on an expired token; a tampered token means something is wrong.
- A valid token for a **deleted user** is still rejected by `/me` (the user lookup fails → 401).
- **The `Bearer` scheme name is case-insensitive** (RFC 9110). The first regex `/^Bearer …/` rejected `bearer <token>`, which some HTTP clients send. Fixed with the `i` flag (found in QA).

### bcrypt details
- **Cost factor 12** ≈ 250 ms per hash; each +1 doubles the time. Tests use 4, so 48 tests run in ~2s instead of ~15s.
- **72-byte limit:** bcrypt silently ignores everything after 72 **bytes**, so `"a"*72 + "anything"` would match. We **reject** passwords over 72 bytes in the shared schema instead of truncating silently.
- **Gotcha (bug found in QA): characters ≠ bytes.** The first version used Zod `.max(72)`, which counts *characters* (UTF-16 units). In UTF-8, `é` is 2 bytes, Telugu/Hindi letters 3, emoji 4. So `"é"×36 + "SECRET-A"` (44 chars, 80 bytes) passed the check, and logging in with `"é"×36 + "anything"` **worked**. Fix: `.refine(pw => utf8ByteLength(pw) <= 72)`, with a small pure byte counter so the same schema runs in the browser and Node (shared has no `TextEncoder`/`Buffer` types).
- **Interview answer:** "bcrypt has a 72-byte input limit. Validate the UTF-8 *byte* length, not `string.length`, or non-ASCII passwords get silently truncated. Alternatives: pre-hash with SHA-256 (careful with null bytes) or use Argon2, which has no such limit."
- `passwordHash` has `select: false`, so it's only loaded with `.select('+passwordHash')` (login only). A `toJSON` transform also strips it as a safety net.

### Cookie gotchas
- **`clearCookie` must use the same `path` (and sameSite/secure) as when the cookie was set.** A cookie is identified by name + path + domain, so clearing `refresh_token` on path `/` leaves the `/api/auth` one in place.
- The refresh endpoint **clears the cookie when refresh fails**, so the browser doesn't keep sending a dead token.
- **`SameSite=None` requires `Secure`**, so env validation rejects `COOKIE_SAMESITE=none` outside production.

### Normalizing input in Zod 4
- `z.email().trim()` checks the format **before** trimming, so `"  a@b.co "` fails. Use `z.string().trim().toLowerCase().pipe(z.email())`: normalize first, then validate.
- The DB also lowercases `email` (`lowercase: true`) and has a **unique index**. Two simultaneous sign-ups slip past the "exists?" check, but the second insert hits duplicate-key error `11000`, which we map to 409.

### TTL index
- `refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })`: MongoDB's background job deletes each document once `expiresAt` passes (it runs about every 60s, so it isn't instant, which is why `refresh()` also checks `expiresAt` itself).

### Test isolation with parallel workers (the bug we hit)
- **Symptom:** every auth test file passed **alone**, but 13 tests failed when run together.
- **Cause:** Vitest runs test files in **parallel workers**, all sharing one database. One file's `afterEach` (empty all collections) deleted users that another file had just created.
- **Fix:** one database per worker: `teamchat-test-${process.env.VITEST_POOL_ID}`.
- **Lesson:** if tests pass alone but fail together, suspect **shared state** (DB, files, ports, module-level variables).
- Grace and reuse tests don't wait 10 real seconds: they **backdate `revokedAt`** in the DB, so time-based logic is tested instantly.

### Rate limiting
- `express-rate-limit`, 10 requests/min per IP, with separate limits for login and register. It's a factory (`createAuthRateLimiter({ enabled })`) so a test can switch it on in a mini app and assert that the 11th request returns 429 in our error format.
- **Behind a proxy** (Nginx, Day 7) every request comes from the proxy's IP, so all users would share one limit. That needs `app.set('trust proxy', 1)`, so the limiter reads the real client IP from `X-Forwarded-For`.
- **Step 2.1: per-USER limits for writes.** `createWriteRateLimiter()` allows 20 creates/min per user across workspace, channel and invite endpoints. It's keyed by `user:<id>` (it runs after `requireAuth`), not by IP:
  - **Why by user:** many users can share one IP (an office, a mobile carrier), and one attacker can rotate IPs but not accounts as easily.
  - **One shared instance = one budget:** creating the limiter once and passing it to several routes makes them all draw from the same per-user counter. Calling the factory per route would give each route its own budget.
  - **Order matters:** it runs *before* validation, so a flood of invalid requests is throttled too. Reads (GET) aren't limited.
  - **Gotcha:** the in-memory store is per process. With 2 instances (Day 5) each would allow 20/min; the fix is a Redis store (`rate-limit-redis`).

### Black-box API testing (thinking like a tester)
- **What:** testing the running server only through HTTP, like a client or attacker would, instead of from inside the code. 60 checks found 3 bugs that 48 unit tests missed, because the unit tests only covered cases the developer thought of.
- **Checklist that found real bugs:**
  - **Boundaries in a different unit:** 72 *bytes* vs 72 *characters* (multibyte input).
  - **Standards:** header names and auth schemes are case-insensitive.
  - **Sequences, not single calls:** logout → refresh, rotate → logout → replay, refresh 5× in parallel.
  - **Error codes:** not just "is it 401?", but "is it the *right* 401?"
- **Also worth checking every time:** wrong JSON types and `null` bodies, NoSQL operators (`{"$ne": null}`), extra fields (mass assignment), body size limit, CORS from a foreign origin, `alg: none` tokens, response timing, rate-limit bypass via a spoofed `X-Forwarded-For`, and **grepping the server log for the password and tokens**.
- **Gotcha:** a "failure" can be the test's own fault. M1 failed because a 5-second token expired while the script waited out a rate limit. Re-check before reporting a bug.
- **Interview answer:** "Unit tests verify what I intended; black-box tests verify what I actually shipped. I test boundaries, sequences, concurrency, and error contracts, and I check the logs for leaked secrets."

---

## Day 1 – Step 1.2b – Design foundation (themes, tokens, components)

### Design tokens with CSS variables + Tailwind 4 `@theme inline`
- **What:** each color is a CSS variable (`--surface`) with a value per theme (`[data-theme="dark"]` / `[data-theme="light"]`). `@theme inline { --color-surface: var(--surface) }` turns it into Tailwind classes (`bg-surface`, `text-surface`, `border-surface`…).
- **Why:** components say *what* a color is for, not *which* color. Switching theme only changes the variables, so no component needs theme logic.
- **`inline` matters:** with it, `bg-surface` compiles to `background: var(--surface)`, resolved at the element. So a nested `<div data-theme="light">` re-themes its whole subtree, and opacity modifiers like `bg-accent/15` still work (Tailwind uses `color-mix()`).
- **Interview answer:** "I use semantic tokens as CSS custom properties. The theme toggle just changes one attribute on `<html>`; every component re-colors through the cascade, with no re-render."

### Tokens beat `dark:` overrides
- **What:** values that differ per theme (input background, text on red buttons, focus ring) became tokens (`field`, `on-danger`, `focus-ring`) instead of `bg-surface dark:bg-bg`.
- **Why:** the `dark:` variant here is `[data-theme="dark"] *`, meaning "has a dark ancestor". A light panel inside a dark page still has a dark ancestor (`<html>`), so it would wrongly get dark styles. Tokens are resolved by the *nearest* `data-theme`, so they're always right.
- **Gotcha:** this showed up immediately in the `/dev/ui` side-by-side preview.

### No flash of the wrong theme (FOUC)
- **What:** a tiny inline `<script>` in `index.html` `<head>` reads `localStorage['tc-theme']` and sets `data-theme` **before the first paint**.
- **Why:** the React bundle is a module script, which runs after the HTML is parsed. If the theme were applied there, a light-theme user would see a dark flash on every load.
- **Gotchas:**
  - Wrap `localStorage` in try/catch: it throws in some private modes and when storage is blocked.
  - A strict CSP blocks inline scripts. Allow this one by its sha256 hash (Day 7 TODO).
- **Interview answer:** "Anything that changes the first paint (theme, locale direction) must run synchronously in the head, before the app bundle."

### Sharing state outside React: `useSyncExternalStore`
- **What:** `useTheme()` subscribes to a tiny store (a Set of listeners) whose value is read from `<html data-theme>`.
- **Why:** the theme lives in the DOM, outside React. `useSyncExternalStore` is React's official way to read external state: no tearing in concurrent rendering, and every subscriber re-renders when it changes. No Context provider needed.

### Self-hosted variable fonts (`@fontsource-variable`)
- **What:** `import '@fontsource-variable/inter'` bundles the font files with the app (no Google Fonts request: faster, no third-party tracking, works offline).
- **Gotcha:** the packages register the family as **"Inter Variable"** / **"JetBrains Mono Variable"**. Writing `font-family: "Inter"` matches nothing and **silently** falls back to the system font. Always check the family name in the package's CSS (or `document.fonts` in DevTools).

### Component API decisions
- **React 19 `ref` is a normal prop:** `Input` spreads `ComponentProps<'input'>` (which includes `ref`), so react-hook-form's `register()` works with no `forwardRef`.
- **Make wrong usage a type error:** `Button size="icon"` requires `aria-label` via a TypeScript union, so an unlabeled icon button doesn't compile.
- **`type="button"` by default:** a `<button>` inside a `<form>` defaults to `submit`, a classic source of accidental submits.
- **Accessible errors:** the error text gets an id and the input points at it with `aria-describedby`, plus `aria-invalid`, so screen readers read the error when the input is focused.

### Dev-only code that never ships
- `const UiPreview = import.meta.env.DEV ? lazy(() => import('./dev/UiPreview')) : null`
- **Why it works:** Vite replaces `import.meta.env.DEV` with `false` in production builds. The minifier then removes the dead branch, and with it the dynamic import, so the page isn't even a separate chunk. We verified this by grepping `dist/`.

### Vite gotcha: "504 Outdated Optimize Dep"
- **Symptom:** after `npm install` of a new package, a running `vite` dev server showed a blank page, with a 504 for `/node_modules/.vite/deps/<pkg>.js`.
- **Cause:** Vite pre-bundles dependencies when it starts. A package installed later has a stale cache hash.
- **Fix:** restart the dev server (or run `vite --force`) after installing new dependencies.

## Day 1 – Step 1.3 – Client auth (router, api client, silent refresh)

### Where the code lives
- `stores/auth.ts`: Zustand store `{ status, restoreStep, accessToken, user }`. Memory only.
- `lib/api.ts`: `api(path, options, schema)` (fetch + Bearer + `credentials: 'include'` + typed `ApiError`) and the single-flight `refreshAccessToken()`.
- `features/auth/session.ts`: `restoreSession()`, `login`, `register`, `logout`. `broadcast.ts`: cross-tab logout.
- `features/auth/routeGuards.tsx`: `RequireAuth` (for /app) and `GuestOnly` (for /login and /register). `router.tsx` holds every route, including the dev-only `/dev/ui`.

### Silent refresh: the 401 → refresh → retry loop
- **What:** every request sends the in-memory access token. On a 401, the client gets a new access token from `/auth/refresh` (the httpOnly cookie goes along automatically) and retries the request **once**. The user never notices that the 15-minute token expired.
- **Why only once:** if the retry fails too, the session is really over. Looping would hammer the server.
- **Refresh fails →** clear the store → `RequireAuth` renders `<Navigate to="/login">`. No `window.location` hacks: the redirect falls out of the state.
- **Trace (expired token, `api('/auth/me')`):**
  1. `api()` reads the token from the store, and `send()` adds `Authorization: Bearer <old>`.
  2. Server `requireAuth` → `jwt.verify` fails → `401 TOKEN_EXPIRED`.
  3. `api()` sees 401 → `refreshAccessToken()` → `POST /api/auth/refresh` with no Bearer header. The browser attaches the `refresh_token` cookie by itself (`credentials: 'include'` + cookie `Path=/api/auth`).
  4. Server checks the cookie's hash, rotates it (new `Set-Cookie`) and returns `{ accessToken }` → saved in the store.
  5. `api()` calls `send()` again with the new token → 200 → parsed with the Zod schema → returned to the caller, which never saw the 401.
- **Gotcha:** login and register use `auth: false`. Their 401 means "wrong password", not "token expired". Refreshing there would be wrong, and could even loop.
- **Interview answer:** "The API client is the one place that knows about tokens. Components just call `api('/x')`. A 401 triggers one shared refresh, then the request is replayed. If the refresh fails, we clear auth state and the router sends the user to login."

### Single-flight refresh (one promise for everyone)
- **What:** a module-level `let refreshPromise`. The first caller starts the refresh. Every caller that arrives while it's in flight `await`s the **same** promise. A `finally` resets it.
- **Why:** refresh tokens rotate. If 3 requests expire together and each calls `/refresh`, the 2nd and 3rd present a token that was just rotated. Our server's 10s grace window would cope, but without one they'd trigger **reuse detection** and log the user out. One refresh = one rotation.
- **Extra trick:** if a 401 comes back but the store already holds a *different* token than the one we sent, someone else already refreshed. Just retry with the new token instead of refreshing again.
- **Verified:** 3 parallel requests with an expired token → 3×401, **1** refresh, 3×200.

### StrictMode and "exactly one refresh on load"
- **What:** in dev, React 18+/19 StrictMode mounts, unmounts and re-mounts every component, so effects run **twice**. A naive `useEffect(() => refresh())` sends two refresh calls.
- **Fix:** `restoreSession()` is memoised (`restorePromise ??= …`), so the second effect run gets the same promise. It runs once per page load.
- **Gotcha:** don't "fix" this by removing StrictMode or using a `useRef` flag. The double run exists to expose effects that aren't idempotent. Make the side effect idempotent instead.

### Loading screen instead of a login flash
- **What:** on page load, `status` starts as `'loading'`. The guards render `<LoadingScreen>` until restore finishes, then either the page or a redirect.
- **Why:** after a reload the access token is gone (memory), but the cookie may still be valid. If we rendered "anonymous" first, the user would see /login flash and then jump to /app.

### Cross-tab logout with BroadcastChannel
- **What:** `new BroadcastChannel('tc-auth')`. On logout this tab posts `{ type: 'logout' }`, and every *other* same-origin tab clears its store, which redirects it to /login.
- **Why it's needed:** the cookie is shared by all tabs, but each tab has its own in-memory access token. Without the message, tab B would keep working until its token expired.
- **Gotcha:** the sender doesn't receive its own message. Never send secrets over it, only the event.

### Protected routes with React Router (data router)
- `createBrowserRouter([...])` + `<RouterProvider>`. Guards are **layout routes** that render `<Outlet/>` or `<Navigate replace/>`.
- `RequireAuth` passes `state={{ from: location }}`, so after login `GuestOnly` sends the user back where they were going.
- `replace` matters: without it, the Back button returns to the protected URL, which redirects again (a back-button trap).

### Forms: react-hook-form + the shared Zod schema
- `useForm({ resolver: zodResolver(loginSchema), mode: 'onTouched' })`: the **same** schema the server validates with, so the client and server messages match.
- **Server errors are mapped into the form:** `VALIDATION_ERROR` details go to `setError(field)`, `EMAIL_TAKEN` goes to the email field (with a "Sign in instead" link), and anything else to `setError('root.server')`, shown in a `role="alert"` box. 5xx messages are replaced with a generic one.
- **Uncontrolled inputs:** RHF reads values through refs, so typing doesn't re-render the whole form. `useWatch` subscribes only to the password field (for the strength meter).

### 🎯 Why queue requests during a refresh?
- **What:** while one refresh is running, other requests that hit a 401 wait for it (they share the promise) instead of starting their own.
- **Why:** with rotation, each refresh invalidates the previous refresh token. Parallel refreshes race: one wins, and the others present an already-used token, which looks like token theft and kills the session. Queuing also means fewer requests, and every waiting request is retried with the one new token.
- **Interview answer:** "Because refresh tokens are single-use. If five requests all refresh at once, four of them replay a rotated token and trip reuse detection. A single-flight promise makes them wait for one refresh and then retry."

✍️ In my own words:

### 🎯 Why not keep the token in localStorage?
- **What:** localStorage is readable by **any** JavaScript running on the page. One XSS bug (a malicious npm package, an unescaped message) can read the token and send it anywhere, and use it from the attacker's machine until it expires.
- **Our setup:** the access token lives in memory (a JS variable, gone on reload, short-lived: 15 min). The refresh token is in an **httpOnly** cookie that JS can't read at all, limited to `Path=/api/auth`, `SameSite=Strict`, and rotated with reuse detection.
- **Honest caveat:** memory isn't XSS-proof either. Injected script can still *use* the token while the page is open. What it can't do is steal a long-lived credential. XSS prevention (escaping, CSP) is still the real defense.
- **Interview answer:** "localStorage turns any XSS into a stolen session. In memory, a token is short-lived and disappears on reload, and the long-lived refresh token sits in an httpOnly cookie that scripts can't read."

✍️ In my own words:

## Day 2 – Step 2.1 – Access control concepts (before coding)

### RBAC, scoped per workspace
- **What:** role-based access control. A user's permissions come from their **role** (owner, admin, member), not from rules written per person.
- **Scoped:** the role lives on `Membership { workspaceId, userId, role }`, **not** on `User`. One person can be the owner of "Acme" and a member of "Side Project". A global `user.role` only fits single-tenant apps.
- **Hierarchical:** owner > admin > member. A higher role can do everything a lower one can. Check it with a rank map instead of listing roles everywhere:
  ```ts
  const RANK = { member: 1, admin: 2, owner: 3 } as const;
  const allowed = RANK[membership.role] >= RANK[minRole];
  ```
- **In this project:** `requireMembership(minRole?)` middleware loads the membership for `(req.user.id, :workspaceId)`, returns 403 if it's missing or too low, and attaches it to `req` for the controller.
- **Gotcha:** don't put the role in the JWT. Roles change (demote, remove), and a 15-minute token would keep the old power until it expires. Read it from the DB on each request (an indexed lookup; it can be cached in Redis later).

### RBAC vs ReBAC vs ABAC
| Model | Question it answers | In this project |
|---|---|---|
| RBAC | "What is your role?" | owner / admin / member per workspace |
| ReBAC (relationship-based, Google Zanzibar) | "How are you related to this object?" | private channels: are you a member of *this* channel? |
| ABAC (attribute-based) | "Do the attributes match a rule?" | Day 3: edit only your own message; delete if you're the author or an admin |
- **Real apps mix them:** roles for coarse permissions, relationships for sharing, attribute rules for ownership and time limits.

### Permission checks belong on the server
- The client can hide buttons for UX, but every rule is enforced in middleware and services. Anyone can call the API with curl.
- **Interview answer:** "We use RBAC scoped per workspace: the role lives on the membership, so one person can have different roles in different workspaces. Roles are hierarchical, and a `requireMembership(minRole)` middleware checks them on every request from the DB, not from the JWT, so a demotion takes effect immediately. Private channels add a relationship check on top, which is closer to ReBAC, and per-message rules like 'only the author can edit' are attribute checks in the service layer."

## Day 2 – Step 2.1 – Workspaces, channels and pagination

### Where the code lives
- Models: `Workspace`, `Membership` (role), `Channel` (`memberIds` for private), `Message`.
- Middleware: `requireMembership(minRole)` (routes with `:workspaceId`) and `requireChannelAccess` (routes with `:channelId`).
- Services: `workspace.service.ts`, `channel.service.ts`, `message.service.ts`. Shared schemas: `common.ts` (objectId), `workspace.ts` (roles, `ROLE_RANK`), `channel.ts`, `message.ts`.

### 403 vs 404 (don't leak what exists)
- **What:** a non-member asking for any workspace id, existing or not, gets the same **403**. Otherwise "403 = exists, 404 = doesn't" lets an outsider probe ids.
- **In this project:** malformed ids → 400 (validated by Zod before any DB query, so no Mongoose `CastError` 500). Unknown **channel** ids → 404; we accept that small leak because ObjectIds aren't guessable. (GitHub goes further and returns 404 for private repos you can't see.)

### Unique index as the source of truth (no check-then-insert)
- **What:** to stop duplicate memberships or channel names, don't `findOne` and then `create`: two requests can both pass the check. Insert, and catch MongoDB error **11000** (duplicate key) → 409.
- **In this project:** `{ workspaceId, userId }` unique on Membership → `ALREADY_MEMBER`; `{ workspaceId, name }` unique on Channel → `CHANNEL_NAME_TAKEN` (so "#random" can exist in two workspaces).
- **Retry vs 409:** when the clash is the *server's* fault (a random slug that happened to collide), retry with a new value (up to 3 times) instead of failing. When it's the *user's* input (a taken channel name), return 409. The slug generator is a parameter (`createWorkspace(userId, input, generateSlug)`), so a test can force a collision: **dependency injection for testability**.

### Multi-document writes without a transaction
- **What:** creating a workspace writes 3 documents. MongoDB transactions need a replica set, and our in-memory test DB is a single node.
- **In this project:** write them in order and, if a later write fails, delete the earlier ones (a **compensating action**, like a mini saga). Atlas is a replica set, so we could switch to `session.withTransaction()` later if tests run `MongoMemoryReplSet`.
- **Interview answer:** "Either a transaction, or ordered writes with compensation and idempotent retries. Transactions are simpler to reason about, but cost more and need a replica set."

### Cursor pagination: the query
```ts
Message.find({ channelId, ...(before && { _id: { $lt: before } }) })
  .sort({ _id: -1 })
  .limit(limit + 1); // one extra row = "is there another page?" (no count() query)
```
- The cursor is the **last message id** of the page. ObjectIds start with a timestamp, so `_id` order ≈ creation order and is unique (no ties, unlike `createdAt`).
- Response: `{ messages, nextCursor }`. `nextCursor: null` means no more pages.
- **Proved in a test:** `explain('executionStats')` shows the plan uses `channelId_1__id_-1`, has **no SORT stage**, and examines 31 documents for a 31-row page even with 80 messages in the collection.

### 🎯 Why cursor pagination instead of skip/limit?
- **Speed:** `skip(10000)` still walks past 10,000 index entries, so deep pages get slower and slower. A cursor (`_id < X`) **seeks** straight to X in the index; every page costs the same.
- **Correctness:** chat gets new messages all the time. With skip, a new message pushes everything down by one, so the next page repeats a message (or, with deletes, skips one). A cursor is anchored to a specific message, so pages never overlap or miss rows.
- **Trade-off:** no "jump to page 57" and no total page count, which a chat doesn't need (infinite scroll only goes "older").
- **Interview answer:** "Skip is O(offset) and unstable when rows are inserted. Cursor pagination is O(page size) via an index seek and stable, because each page starts after a specific row. Infinite-scroll feeds and chat history should always use cursors."

✍️ In my own words:

### 🎯 Why is the index { channelId, _id } and not just channelId?
- **What:** the query **filters** by `channelId` and **sorts** by `_id`. A compound index stores entries sorted by channelId, and *within each channel* by `_id`. MongoDB jumps to the channel, then reads the entries already in order and stops after `limit` rows.
- **With only `{ channelId }`:** MongoDB finds every message in the channel, then **sorts them in memory** to get the newest 30. A channel with 1M messages means a 1M-document sort (and a 100 MB in-memory sort limit) on every scroll.
- **Rule of thumb (ESR):** order compound index fields **E**quality → **S**ort → **R**ange. Here `channelId` (equality), then `_id` (sort, and also the `$lt` range).
- **Direction:** `_id: -1` matches our newest-first sort, though a single-field direction can be walked both ways, so `_id: 1` would also work. Direction only matters when several sort fields mix directions.
- **Interview answer:** "The compound index covers both the filter and the sort, so the query is an index seek plus a bounded read, with no in-memory sort. Equality first, then the sort field."

✍️ In my own words:

## Day 2 – Step 2.1 – Architecture diagrams (roles, workspaces, channels, members)

Diagrams are plain text so they render everywhere (VS Code preview, GitHub, terminal).

### Data model: who owns what
```
 ┌──────────┐ 1      n ┌──────────────────────────┐ n      1 ┌─────────────┐
 │   User   │──────────│        Membership        │──────────│  Workspace  │
 │ name     │          │ userId                   │          │ name        │
 │ email ⓤ  │          │ workspaceId              │          │ slug ⓤ      │
 └──────────┘          │ role: owner|admin|member │          │ ownerId     │
      ▲                │ ⓤ { workspaceId, userId } │          └─────────────┘
      │                └──────────────────────────┘                 │ 1
      │ memberIds[] (private channels only)                         │
      │                                                             │ n
      │                ┌──────────────────────────┐                 │
      └────────────────│         Channel          │─────────────────┘
                       │ workspaceId, name        │
                       │ isPrivate, memberIds[]   │
                       │ createdBy                │
                       │ ⓤ { workspaceId, name }  │
                       └──────────────────────────┘
                                    │ 1
                                    │ n
                       ┌──────────────────────────┐
                       │         Message          │
                       │ channelId, authorId      │
                       │ body, attachments, ...   │
                       │ idx { channelId, _id:-1 }│
                       └──────────────────────────┘
 ⓤ = unique index
```
- **What:** User ↔ Workspace is many-to-many, and **Membership is the join table that also holds the role**. That's what makes RBAC *scoped*: the role belongs to the pair (user, workspace), not to the user.
- **Why `memberIds` on Channel and not a ChannelMembership collection:** private channels are small, and the check is one array lookup on a document we already loaded. A separate collection pays off only for huge channels or per-channel roles.
- **Gotcha:** `ownerId` on Workspace is informational (who created it). The **authority** is `Membership.role = 'owner'`, because that's what the middleware reads.

### The role ladder (what each role can do today)
```
  owner ─┐  rank 3   everything admin can do (+ later: delete workspace, transfer ownership)
         │
  admin ─┤  rank 2   invite members (as admin or member)
         │
  member ┘  rank 1   list workspaces/members/channels, create channels,
                     read history of public channels + private channels they're in

  check: ROLE_RANK[myRole] >= ROLE_RANK[minRole]
```
| Endpoint | Min role | Extra rule |
|---|---|---|
| `POST /api/workspaces` | logged in | creator becomes owner |
| `GET /api/workspaces` | logged in | only your own memberships |
| `GET /api/workspaces/:id/members` | member | |
| `POST /api/workspaces/:id/members` | **admin** | role must be admin or member (never owner) |
| `GET /api/workspaces/:id/channels` | member | private channels only if you're in `memberIds` |
| `POST /api/workspaces/:id/channels` | member | private → creator is the first member |
| `GET /api/channels/:id/messages` | member | private → must be in `memberIds` |

### Request pipeline (every protected route)
```
 HTTP request
     │
     ▼
 requireAuth ──────────── no/invalid Bearer token ──► 401 UNAUTHORIZED
     │  req.user = { userId }   (from the JWT: identity only, never the role)
     ▼
 writeLimit (POSTs only) ─ >20 creates/min for this user ─► 429
     │
     ▼
 validate({ params, body, query }) ── bad ObjectId / bad body ──► 400 VALIDATION_ERROR
     │  (runs before any DB query → no CastError 500s)
     ▼
 requireMembership(minRole)  or  requireChannelAccess
     │  DB lookup of the role ── not a member / role too low ──► 403 FORBIDDEN
     │  req.membership (and req.channel)
     ▼
 controller ─► service ─► model ─► MongoDB
     │                       └── E11000 duplicate ──► 409 (ALREADY_MEMBER / CHANNEL_NAME_TAKEN)
     ▼
 2xx JSON
```
- **Interview answer:** "Authentication says *who you are* (the JWT), authorization says *what you may do here* (the membership row read fresh from the DB). Cheap checks run first: auth, rate limit, shape validation. Then one indexed DB lookup for the role, and only then the business logic."
- **Gotcha:** the rate limiter runs **before** validation on purpose, so a flood of invalid requests still uses up the budget.

### Flow: `requireMembership(minRole)` (RBAC)
```
 Membership.findOne({ workspaceId: :workspaceId, userId })
          │
   found? ├── no ──► 403 "You do not have access to this workspace"
          │          (same answer if the workspace doesn't exist → no id probing)
          ▼ yes
 ROLE_RANK[role] >= ROLE_RANK[minRole]?
          ├── no ──► 403 "This action needs the admin role or higher"
          ▼ yes
 req.membership = membership → next()
```

### Flow: `requireChannelAccess` (RBAC + ReBAC)
```
 Channel.findById(:channelId)
          ├── not found ──► 404 CHANNEL_NOT_FOUND
          ▼
 Membership in channel.workspaceId?            ← RBAC: are you in the workspace?
          ├── no ──► 403
          ▼
 channel.isPrivate?
          ├── no ─────────────────────────┐
          ▼ yes                           │
 userId in channel.memberIds?             │    ← ReBAC: are you related to *this* channel?
          ├── no ──► 403 "This channel is private"
          ▼ yes                           │
 req.channel, req.membership ◄────────────┘ → next()
```
- **Why the workspace check comes first, even for public channels:** "public" means public **inside the workspace**, not on the internet.

### Flow: create a workspace (3 writes, compensated)
```
 POST /api/workspaces { name: "Acme" }
   │
   ├─1─ Workspace.create({ name, slug: "acme-3f9a1c", ownerId })
   │      └─ E11000 on slug? retry with a new suffix (max 3 tries)
   ├─2─ Membership.create({ role: "owner" })   ─┐
   ├─3─ Channel.create({ name: "general" })     ├─ any failure → delete 1, 2, 3 → rethrow
   │                                            ─┘
   ▼
 201 { workspace: { id, name, slug, role: "owner", ... } }
```

### Flow: invite a member
```
 Alice (admin+)                         Server                               DB
   │ POST /workspaces/:id/members         │                                   │
   │ { email: " Charlie@Test.dev " } ────►│ Zod: trim + lowercase, role ≠ owner│
   │                                      │ requireMembership('admin') ──────►│ Alice's role?
   │                                      │ User.findOne({ email }) ─────────►│
   │◄── 404 USER_NOT_FOUND (no account) ──│                                   │
   │                                      │ Membership.create(...) ──────────►│ unique {ws,user}
   │◄── 409 ALREADY_MEMBER (E11000) ──────│                                   │
   │◄── 201 { member } ───────────────────│                                   │
```
- Charlie is added immediately (no accept step). Pending invites for emails without an account come on Day 5.

### Flow: channel visibility (what `GET /channels` returns)
```
 Channel.find({ workspaceId, $or: [ { isPrivate: false }, { memberIds: userId } ] }).sort({ name: 1 })

   #general  (public)               → everyone in the workspace
   #random   (public)               → everyone in the workspace
   #secret   (private, [alice])     → only Alice
```
- **Gotcha:** the filter is in the **query**, not applied afterwards in JS, so private channel names never leave the database for people who can't see them.
- **Open decision:** should owners/admins see private channels they aren't in? Slack says no by default; we follow that for now.

### End-to-end: a member reads history
```
 Bob ── GET /api/channels/:cid/messages?limit=30 ──► requireAuth ► validate ► requireChannelAccess
                                                                                     │
      ◄── { messages: [30 newest], nextCursor: "<id of the 30th>" } ◄── Message.find(_id < before)
                                                                          .sort(_id -1).limit(31)
 Bob ── GET ...?before=<nextCursor> ──► next 30 older ... until nextCursor = null
```

### Interview answer: "walk me through your multi-tenant authorization"
"Every resource hangs off a workspace. A user joins a workspace through a Membership row that carries their role, so roles are per workspace. Each request goes through auth (JWT gives identity only), then Zod validation, then a middleware that loads the membership from the DB and compares role ranks. Channels add a relationship check for private ones. Non-members get 403 whether or not the workspace exists, uniqueness is enforced by database indexes rather than check-then-insert, and lists are filtered in the query so hidden data never leaves the DB."

## Day 2 – Step 2.2 – Socket.IO server (rooms, acks, presence)

### Where the code lives
- Contract (shared by client and server): `packages/shared/src/socket/events.ts`, which holds event names, Zod payload schemas, the `Ack` type and typed `ClientToServerEvents` / `ServerToClientEvents` maps.
- Server: `apps/server/src/socket/`, with `index.ts` (creates the server), `auth.ts` (handshake), `handle.ts` (validate + ack wrapper), `presence.ts`, `rateLimit.ts` and `handlers/` (channel, message, typing, presence).
- One access rule for HTTP and sockets: `assertChannelAccess()` in `services/access.service.ts`.
- Tests: `apps/server/test/socket.test.ts` (a real server on port 0 + `socket.io-client`).

### One HTTP server, two protocols
```
              ┌──────────── http.createServer(app) : 4000 ────────────┐
 GET /api/... │──► Express (routes, middleware)                         │
 /socket.io/  │──► Socket.IO (long-polling requests + WebSocket upgrade)│
              └─────────────────────────────────────────────────────────┘
```
- **What:** `app.listen()` creates an HTTP server internally. To attach Socket.IO we create it ourselves (`createServer(app)`) and pass it to both. Socket.IO grabs requests under `/socket.io/`, and everything else goes to Express.
- **Why:** one port, one CORS/proxy setup, and the same process can share code (services, models) between REST and realtime.
- **Gotcha:** shutdown. `io.close()` disconnects every socket **and** closes the HTTP server. Call it instead of `server.close()`, otherwise open WebSockets keep the process alive until the 10 s force-exit.

### Handshake auth (socket middleware)
```
 client: io(url, { auth: { token } })
           │
           ▼
 io.use(socketAuth) ── no token ──────► connect_error { message, data: { code: 'UNAUTHORIZED' } }
           │        ── bad/expired ───► connect_error { data: { code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' } }
           ▼ ok
 socket.data = { userId, workspaceIds }  ──► 'connection' handler runs
```
- **What:** `io.use()` runs once per connection, **before** `connection`. Calling `next(err)` refuses the connection, and the client gets `connect_error` with `err.message` and `err.data`.
- **Why `auth.token` and not `?token=` in the URL:** URLs end up in proxy logs, access logs and browser history. The `auth` object travels in the handshake body (polling) or the first WebSocket frame, not the URL.
- **Gotcha:** the token is checked **once**. A socket opened with a token that expires 15 minutes later stays connected. That's the usual trade-off. The client must send a *fresh* token when it reconnects (Step 2.3: `auth` as a function that reads the store), and a stricter app re-checks on a timer or disconnects on logout.

### Rooms
- **What:** a room is a server-side label for a group of sockets. `socket.join('channel:42')`, then `io.to('channel:42').emit(...)` reaches every socket in it. Clients can't see or join rooms by themselves; only server code calls `join`.
- **In this project:** `channel:<id>` (joined with `channel:join` after the access check) and `workspace:<id>` (joined automatically on connect, used for presence).
- **Who gets the event:**

| Call | Reaches |
|---|---|
| `io.to(room).emit` | everyone in the room, **including the sender** (we use it for `message:new`: your other tabs need it too) |
| `socket.to(room).emit` | the room **except this socket** (we use it for typing: you don't need your own indicator) |
| `socket.emit` | only this socket |

- **Gotcha:** joining a room is not a permission check. We still re-check access on **every** `message:send`, because membership can change while the socket is open.

### Validate every event (and never crash)
- **What:** socket payloads are untrusted input like HTTP bodies, but there's no Express error handler. A thrown error in a listener is an unhandled rejection.
- **In this project:** `handle(schema, fn)` parses with Zod, runs the handler, and always answers the ack with `{ ok: true, ...result }` or `{ ok: false, error: { code, message } }`, using the same codes as HTTP (`VALIDATION_ERROR`, `FORBIDDEN`, `CHANNEL_NOT_FOUND`, `RATE_LIMITED`). It also checks that `ack` really is a function, since a client could send anything.
- **Fire-and-forget events** (`typing:*`) use `safeParse` and silently drop bad payloads: no ack, no DB, because they fire on keystrokes.

### Save, then broadcast (message:send)
```
 Alice ── message:send { channelId, body, tempId } ──► server
                                                         │ 1. Zod (trim, 1–4000 chars)
                                                         │ 2. rate limit (10 / 10 s per user)
                                                         │ 3. assertChannelAccess (DB)
                                                         │ 4. Message.create  ← saved first
                                                         │ 5. io.to('channel:<id>').emit('message:new', { message, tempId })
 Alice ◄── ack { ok: true, message } ────────────────────┘
 Bob   ◄── message:new { message, tempId }
```
- **Why save first:** if the broadcast went out and the save failed, people would see a message that disappears on reload.
- **Why `tempId`:** the client shows the message instantly with a temporary id. The ack (and the broadcast) carry the same `tempId`, so the client can replace the "sending…" row with the real one and drop duplicates.

### Presence with socket counts
```
 Map<userId, socketCount>
   Ravi opens tab 1:  0 → 1   → emit presence:update { online: true } to his workspaces
   Ravi opens tab 2:  1 → 2   → nothing (already online)
   Ravi closes tab 1: 2 → 1   → nothing (still online)
   Ravi closes tab 2: 1 → 0   → emit presence:update { online: false }
```
- **Why count instead of a Set of user ids:** with a Set, closing one tab would mark you offline while another tab is still open.
- **`presence:list`:** `presence:update` only sends *changes*, so a page that just loaded asks once for the current list (only for workspaces you belong to).
- **Gotcha:** this lives in one process's memory. See the third 🎯 question below.

### Testing sockets
- Start a real server on **port 0** (the OS picks a free port), connect with `socket.io-client` using `transports: ['websocket']`, `reconnection: false` and `forceNew: true`, and close everything in `afterEach`.
- Use `socket.timeout(ms).emitWithAck(...)` to `await` an ack. To prove something did **not** arrive, record events and wait briefly.

### 🎯 How is Socket.IO different from raw WebSocket?
- **WebSocket** is a protocol (RFC 6455): a persistent, full-duplex TCP connection that you open with an HTTP `Upgrade`. You get `send(string|binary)` and `onmessage`, and nothing else.
- **Socket.IO** is a library **on top**, with its own protocol, so a plain WebSocket client can't talk to a Socket.IO server. It adds:
  - **Fallback:** starts with HTTP long-polling (or WebSocket directly) and upgrades, so it works behind proxies that block WebSockets.
  - **Auto-reconnect** with backoff, and buffering of events emitted while disconnected.
  - **Named events** with JSON (`emit('message:send', {...})`) instead of parsing every raw message yourself.
  - **Acknowledgements** (request/response over the socket).
  - **Rooms and namespaces** for server-side broadcasting.
  - **Heartbeats** (ping/pong) to detect dead connections.
  - **Adapters** (for example Redis) to broadcast across several servers.
- **Cost:** a slightly bigger client bundle, a custom protocol, and sticky sessions when scaling (because of polling).
- **Interview answer:** "WebSocket is the transport; Socket.IO is a framework over it that adds reconnects, fallback to polling, named events, acks, rooms and multi-server adapters. I'd use raw WebSocket for a tiny or high-throughput protocol, and Socket.IO for an app like chat where I'd otherwise rebuild all of that."

✍️ In my own words:

### 🎯 Why use acknowledgements?
- **What:** an ack is a callback passed with `emit` that the server calls with a result, which gives you request/response over the socket: `const res = await socket.emitWithAck('message:send', payload)`.
- **Why:** without one, the sender can't know whether the message was **saved**, **rejected** (validation, no access, rate limit) or **lost** (connection dropped). With an ack:
  - success → replace the optimistic row with the saved message (real id, server timestamp);
  - `{ ok: false }` → show the error;
  - no answer within a timeout → mark "failed – retry".
- **Why not wait for the `message:new` broadcast instead:** it doesn't carry errors, and it only arrives if you're in the room.
- **Interview answer:** "Acks turn fire-and-forget emits into confirmed operations. The client gets the saved record or a typed error for exactly that request, which is what optimistic UI needs to confirm or roll back. A timeout on the ack covers a lost connection."

✍️ In my own words:

### 🎯 What breaks if I run two server instances?
```
            ┌─ instance 1: Alice's socket, rooms {channel:42}, presence {alice:1}
 Nginx ─────┤
            └─ instance 2: Bob's socket,   rooms {channel:42}, presence {bob:1}

 Alice sends → instance 1 → io.to('channel:42') → only sockets on instance 1 → Bob never sees it
```
- **Rooms:** each instance only knows its own sockets, so broadcasts don't cross instances.
- **Presence:** each instance has its own `Map`, so Alice's server thinks Bob is offline, and `presence:list` is wrong.
- **Rate limits** (socket and REST) count per instance, so the real limit becomes N × the limit.
- **Long-polling:** consecutive HTTP requests for one session can hit different instances, and the handshake fails without **sticky sessions**.
- **Fix (Day 5):** `@socket.io/redis-adapter` (every `emit` to a room is published through Redis pub/sub and each instance delivers to its local sockets), presence counts and rate limits in Redis, and sticky sessions in Nginx.
- **Interview answer:** "Socket state is per process: rooms, presence and in-memory counters. With two instances, broadcasts only reach local sockets and presence disagrees. The Redis adapter fans out emits to all instances, shared state moves to Redis, and the load balancer needs sticky sessions for the polling transport."

✍️ In my own words:
