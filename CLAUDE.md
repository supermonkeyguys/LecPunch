# CLAUDE.md

This file provides guidance to coding agents working in this repository.

## Primary References

Read these before making structural changes:

- `AGENTS.md`
- `docs/superpowers/specs/2026-03-31-lecpunch-architecture-design.md`
- `docs/superpowers/plans/2026-04-12-member-weekly-follow-ups.md`

If these documents conflict:

- use the execution plan for current task order
- use the architecture spec for product and technical boundaries
- use `AGENTS.md` for task execution, git, and collaboration rules

## Repository Status

The repository is no longer in planning-only mode. The current baseline is V1.1 with these delivered capability groups:

- member-facing attendance flows
- network policy enforcement and admin management
- minimal admin capabilities for member management and records export
- targeted tests, typecheck, and build commands in the workspace

Current V1.1 scope:

- Pure web app
- Single-team data model with `teamId` preserved
- Username/password auth
- Server-authoritative attendance rules
- Same-team data visibility in V1.1
- Minimal `/admin/*` operations inside the same web app

Current V1.1 non-scope:

- Multi-team product flows
- Leave or make-up request workflows
- Excel export
- Push notifications
- Offline sync

## Architecture Boundaries

Keep these boundaries intact unless the user explicitly changes them:

- Business truth stays on the server
- Preserve `Asia/Shanghai` as the system time basis
- Preserve the established API split between `attendance`, `records`, `stats`, `users`, and `network-policy`
- Frontend pages stay focused on composition; move heavier business logic into features/widgets
- `packages/shared` contains stable cross-app contracts only
- `packages/ui` stays presentation-only

## Backend Rules That Must Hold

- Check-in requires authenticated, active users with no active session and an allowed network
- Check-out requires an existing active session and an allowed network
- Sessions with duration `>= 18000` seconds are invalidated with `invalidReason = overtime_5h`
- Same-team access is allowed in V1.1; cross-team access must be rejected server-side
- Network checks are evaluated on the backend, not in the browser

## Current Admin Surface

Admin users currently have these routes:

- `/admin/members`
- `/admin/network-policy`
- `/admin/records-export`

Related API surface:

- `GET /users/admin/members`
- `PATCH /users/admin/members/:userId`
- `GET /network-policy/admin/current`
- `PATCH /network-policy/admin/current`
- `GET /records/admin/export`

## Commands

Install dependencies:

```bash
pnpm install
```

Start the API:

```bash
pnpm --filter @lecpunch/api dev
```

Start the web app:

```bash
pnpm --filter @lecpunch/web dev
```

Run all tests:

```bash
pnpm test
```

Run workspace typecheck:

```bash
pnpm typecheck
```

Run workspace build:

```bash
pnpm build
```

Run API tests only:

```bash
pnpm --filter @lecpunch/api test
```

Run web tests only:

```bash
pnpm --filter @lecpunch/web test
```

Run a targeted API test:

```bash
pnpm --filter @lecpunch/api exec vitest run src/modules/attendance/attendance.service.spec.ts
```

Run a targeted web test:

```bash
pnpm --filter @lecpunch/web exec vitest run src/pages/dashboard/DashboardPage.test.tsx
```

Seed demo accounts:

```bash
pnpm --filter @lecpunch/api seed
```

Demo seed result:

- `demo-admin` / `123456`
- `demo-member` / `123456`

If `packages/shared/dist` is missing and the API cannot resolve `@lecpunch/shared`, build it once:

```bash
pnpm --filter @lecpunch/shared build
```

## Environment Notes

API:

- copy `apps/api/.env.example` to `apps/api/.env`
- set `AUTH_SECRET` to at least 16 characters
- keep `ATTENDANCE_BALANCED_ACCOUNTING_ENABLED=true` to enable server-credited attendance slices
- when `ALLOW_ANY_NETWORK=false`, configure `ALLOWED_PUBLIC_IPS` or `ALLOWED_CIDRS`

Web:

- copy `apps/web/.env.example` to `apps/web/.env`
- keep `VITE_API_BASE_URL=` empty for local Vite proxy mode
- set a full origin only when the frontend should call a deployed API directly

## Execution Guidance

Unless the user says otherwise, continue work by following the next unfinished item in:

- `docs/superpowers/plans/2026-04-12-member-weekly-follow-ups.md`

Work one self-contained task at a time, verify the relevant changes, then create one atomic commit and push the current branch.
