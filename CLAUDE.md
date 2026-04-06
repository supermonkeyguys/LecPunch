# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repository is currently in the planning stage. The main source of truth for the MVP is `docs/superpowers/specs/2026-03-31-lecpunch-architecture-design.md`.

Current agreed scope for V1:
- Pure Web MVP
- Member-facing flows first
- Single team for now, but keep `teamId` in domain models
- Username/password login
- Network restriction implemented by backend IP/CIDR allowlist checks
- Weekly statistics prioritized for V1
- No make-up requests, leave system, Excel export, push notifications, or offline sync in V1

If `prd.md`, `UI.md`, and the architecture spec conflict, follow the architecture spec for implementation unless the user says otherwise.

## Product and architecture references

Read these before making structural changes:
- `docs/superpowers/specs/2026-03-31-lecpunch-architecture-design.md` — MVP scope, domain rules, API contract, package boundaries, phased rollout
- `prd.md` — broader product backlog; includes ideas intentionally deferred from V1
- `UI.md` — UI structure and component decomposition reference for the member-facing web app

## Planned workspace shape

The intended repository structure is a pnpm + Turbo monorepo:

```txt
apps/
  web/        React member web app
  api/        NestJS API
packages/
  ui/         reusable headless/presentational UI primitives
  shared/     cross-app domain types, enums, constants, light schemas
  eslint-config/
  tsconfig/
docs/
  superpowers/
    specs/
    plans/
```

The repository may not contain all of these directories yet. Prefer creating the minimum needed to match the architecture spec rather than inventing alternate structure.

## Frontend architecture

Frontend stack target:
- React
- React Router
- Zustand
- ahooks
- Axios
- Tailwind CSS
- Radix UI
- react-hook-form
- zod

Follow the layered structure defined in the spec:

```txt
apps/web/src/
  app/        route registration, providers, store setup, axios setup, global styles
  pages/      page-level composition only
  widgets/    larger page sections composed from features/entities
  features/   business actions, request hooks, store bindings
  entities/   stable domain presentation units
  shared/     UI-neutral helpers, hooks, constants, HTTP utilities
```

Important boundaries:
- Keep UI and data logic separated
- Do not put business truth in Zustand; server responses remain authoritative
- `packages/ui` stays presentation-only and must not depend on business requests or feature state
- `packages/shared` only contains stable cross-app contracts, not frontend hooks or backend services

## Backend architecture

Backend stack target:
- NestJS
- TypeScript
- MongoDB

Suggested backend module boundaries:
- `auth` — login, JWT, current-user lookup
- `users` — user profile, role, team relationship
- `teams` — team metadata and future multi-team extension points
- `attendance` — check-in/out lifecycle, active session, 5-hour invalidation rule
- `records` — detail queries for self and teammates
- `stats` — weekly aggregations and history views
- `network-policy` — IP/CIDR allowlist evaluation and proxy trust rules

Business truth must stay on the server, especially for:
- whether a user currently has an active session
- whether a session is valid or invalidated
- whether the current network is allowed
- weekly aggregates and cross-user access control

## Core domain rules

Implement these exactly unless the user changes the spec:
- Check-in requires authenticated user, active user status, no existing active session, and allowed network
- Check-out requires an existing active session and allowed network
- If a completed session duration is `>= 18000` seconds, mark it `invalidated`, set duration to `0`, and set `invalidReason` to `overtime_5h`
- Week calculations use `Asia/Shanghai`
- Weekly ranges are natural weeks: Monday 00:00:00 through Sunday 23:59:59
- Frontend must not attempt to detect Wi-Fi SSID/BSSID; V1 network restriction is backend IP/CIDR allowlist matching
- Same-team members can view each other’s records in V1; cross-team access must be rejected server-side

## API shape to preserve

The architecture spec already defines the first-pass API surface. Before changing endpoint names or payloads, verify whether the change still matches:
- `POST /auth/login`
- `GET /auth/me`
- `GET /attendance/current`
- `POST /attendance/check-in`
- `POST /attendance/check-out`
- `GET /records/me`
- `GET /records/member/:userId`
- `GET /stats/me/weekly`
- `GET /stats/team/current-week`
- `GET /stats/member/:userId/weekly`

Also preserve the explicit split between detail queries (`records`) and aggregate queries (`stats`).

## Testing priorities

Prioritize tests around business rules before UI breadth.

Backend critical cases:
- successful check-in
- duplicate check-in rejected
- successful check-out
- 5-hour invalidation rule
- network not allowed rejection
- same-team allowed / cross-team forbidden record access
- weekly aggregation based on natural week in `Asia/Shanghai`

Frontend critical cases:
- auth route protection
- check-in / check-out button state transitions
- active session timer display
- records page rendering
- members page navigation to member detail
- network-restricted error feedback

E2E is explicitly lower priority than solid backend and frontend focused tests for the MVP.

## Commands

There is no bootstrapped monorepo in the repository yet, so concrete build/test/lint commands are not available yet.

## Commands

```bash
# Install all workspace dependencies
pnpm install

# Start web dev server (port 5173, proxies /api → localhost:4000)
pnpm --filter web dev

# Start API dev server (port 4000, watch mode)
pnpm --filter api dev

# Run all tests
pnpm test

# Run API tests only
pnpm --filter api test

# Run web tests only
pnpm --filter web test

# Run a single API test file
pnpm --filter api exec vitest run src/modules/attendance/attendance.service.spec.ts

# Run a single web test file
pnpm --filter web exec vitest run src/pages/dashboard/DashboardPage.test.tsx

# Lint all packages
pnpm lint

# Typecheck all packages
pnpm typecheck

# Build all packages (shared must build first — handled by Turbo dependency graph)
pnpm build

# Build shared package only (required before first API start if dist/ is missing)
pnpm --filter @lecpunch/shared build

# Seed demo users (demo-admin / demo-member, password: 123456)
pnpm --filter api seed
```

### Prerequisites

- MongoDB running locally on `mongodb://localhost:27017/lecpunch`
- Copy `apps/api/.env.example` → `apps/api/.env` and fill in `AUTH_SECRET` (min 16 chars)
- `apps/web/.env` should exist with `VITE_API_BASE_URL=` (empty = use Vite proxy)
