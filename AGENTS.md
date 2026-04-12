# AGENTS.md

This file provides guidance to Codex and similar coding agents when working in this repository.

## Primary references

Read these before making structural changes:

- `docs/superpowers/specs/2026-03-31-lecpunch-architecture-design.md`
- `docs/superpowers/plans/2026-04-12-member-weekly-follow-ups.md`
- `CLAUDE.md`

If these documents conflict, prefer the latest execution plan for task order and the architecture spec for product and technical boundaries unless the user says otherwise.

## Task execution policy

Unless the user says otherwise, continue work by following:

1. Pick the next unfinished item from `docs/superpowers/plans/2026-04-12-member-weekly-follow-ups.md`.
2. Complete one self-contained task at a time.
3. Run the relevant verification for that task.
4. Create one atomic git commit for the completed task.
5. Push the current branch after the commit.

Do not batch multiple unrelated tasks into one commit unless the user explicitly asks for it.

## Commit and push rules

When a task is completed:

- Commit only after the relevant code changes are finished and verified as far as the environment allows.
- Use a concise commit message that reflects the completed task outcome.
- Push the current branch after committing.
- If push is blocked by missing remote access, auth, safe-directory issues, or sandbox restrictions, stop and report the blocker clearly.
- If verification cannot be run, say so explicitly in the final update before committing and pushing.

Do not commit or push:

- partial exploratory edits
- broken intermediate states unless the user explicitly requests checkpoint commits
- unrelated changes you did not make

## Scope and priorities

Current execution order:

`1 -> 2 -> 3 -> 5 -> 4 -> 6`

Priority source:

- `docs/superpowers/plans/2026-04-12-member-weekly-follow-ups.md`

Current P0 items:

- core attendance business rules
- network policy and security
- member-facing frontend stabilization
- tests, regression, and CI

Current P1 items:

- minimal admin capabilities
- documentation and delivery polish

## Engineering boundaries

- Keep business truth on the server.
- Preserve the API shape already established unless the user asks to change it.
- Keep frontend pages focused on composition; move business logic into features or widgets when complexity grows.
- Preserve `Asia/Shanghai` as the system time basis for attendance and weekly aggregation.

## Git safety

- Never rewrite history unless the user explicitly asks.
- Never revert unrelated user changes.
- Before committing, inspect the worktree and ensure the commit only contains the intended task changes.
