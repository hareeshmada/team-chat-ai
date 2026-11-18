# TeamChat AI – project rules

## Stack
- TypeScript 6 strict mode everywhere
- Monorepo: npm workspaces (apps/client, apps/server, packages/shared)
- Client: React 19 + Vite 8, Tailwind 4 (@tailwindcss/vite, no config file)
  - Not installed yet: TanStack Query (server state), Zustand (UI state), React Router
- Server: Node 24 LTS (>=24), Express 5, Zod 4, Pino 10, tsx 4 (dev)
  - Not installed yet: Mongoose, Socket.IO
- Shared: packages/shared holds Zod schemas, types and socket event names (compiled to dist)
- Tests: Vitest 5 + Supertest 7 (server)
  - Not installed yet: Testing Library (client), Playwright (E2E)
- Tooling: ESLint 10 (flat config) + typescript-eslint 8, Prettier 3
- Infra: Redis 7 via docker-compose; MongoDB runs outside compose

## Version notes
- Express 5: rejected promises in async handlers reach the error handler automatically.
- Zod 4: use `z.url()`, `z.email()`, `z.prettifyError()` (not the v3 `z.string().url()` style).
- TypeScript 6: `types` must be set explicitly in each tsconfig.
- Server uses NodeNext ESM: relative imports need the `.js` extension.

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