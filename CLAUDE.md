# TeamChat AI – project rules

## Stack
- TypeScript 6 strict mode everywhere
- Monorepo: npm workspaces (apps/client, apps/server, packages/shared)
- Client: React 19 + Vite 8, Tailwind 4 (@tailwindcss/vite, no config file), lucide-react icons,
  @fontsource-variable (Inter, JetBrains Mono)
  - React Router 8 (data router), Zustand 5 (auth/UI state), react-hook-form 7 + @hookform/resolvers (Zod)
  - TanStack Query 5 (server state), socket.io-client 4.8
  - react-markdown 10 + remark-gfm 4 + rehype-highlight 7 (AI answers; no raw HTML)
- Server: Node 24 LTS (>=24), Express 5, Mongoose 9, Zod 4, Pino 10, tsx 4 (dev), Socket.IO 4.8
  - AI: Google Gemini via @google/genai 3.6 (GEMINI_API_KEY, AI_MODEL); only services/ai.service.ts uses it
- Shared: packages/shared holds Zod schemas, types and socket event names (compiled to dist)
- Tests: Vitest 5 + Supertest 7 + socket.io-client 4.8 + mongodb-memory-server 11 (server; never touches Atlas)
  - Not installed yet: Testing Library (client), Playwright (E2E)
- Tooling: ESLint 10 (flat config) + typescript-eslint 8, Prettier 3
- Infra: Redis 7 via docker-compose; dev DB is MongoDB Atlas via MONGODB_URI (db: MONGODB_DB_NAME)
- Dev is same-origin: Vite proxies /api and /socket.io (ws) to the server on :4000.
  Mount every API router under /api.

## Version notes
- Express 5: rejected promises in async handlers reach the error handler automatically.
- Express 5: `req.query` is a getter (validate() redefines it); `app.listen` callback receives listen errors.
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

## Build plan
- The full 7-day plan is in docs/PLAN.md. Before starting a step, read only that
  step's section in PLAN.md and follow its prompt, Verify and Learn items.
- Current status: @docs/PROGRESS.md
- After a step's Verify checks pass: tick any matching checkbox in PLAN.md, update
  PROGRESS.md (current step, last completed), and suggest the commit message.
- If we change a decision (library, structure, scope), record it under
  "Decisions / deviations" in PROGRESS.md and update the affected later steps
  in PLAN.md. Never silently diverge from the plan.

## Design
- docs/DESIGN.md is the UI source of truth. Read it before building or changing any screen.
- Visual references are in docs/design/screens/. Before building a screen, read its
  reference file listed in DESIGN.md's screen tracker and match it.
- Use only token classes from the Tailwind theme (bg-surface, text-muted, bg-accent…);
  never hard-code hex colors. Both themes must work.
- Reuse components from src/components/ui; add new ones there and document them in DESIGN.md.
- After building a screen, set its status to "built" in the screen tracker.

## Learning notes (NOTES.md)
- Whenever something is learned (a new concept, a "why" decision, a gotcha, a
  version-specific API, an "explain" answer), append it to NOTES.md under a
  heading for the current day/step, and add that heading to its Contents list.
- Use the format: What / Why / In this project / Interview answer / Gotcha.
  Keep it short and plain; skip fields that don't apply.
- Mark the step's Learn questions from PLAN.md with 🎯 and leave an empty
  "✍️ In my own words:" line under each one for me to fill in. Never fill it in.
- Don't repeat a topic that's already in NOTES.md; extend the existing entry.
- At the end of each step, mention which NOTES.md topics were added.