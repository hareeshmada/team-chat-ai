# TeamChat AI – project rules

## Stack
- TypeScript strict mode everywhere
- Client: React 18 + Vite, TanStack Query (server state), Zustand (UI state), Tailwind, React Router
- Server: Node 20, Express, Mongoose, Socket.IO, Zod, Pino logger
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