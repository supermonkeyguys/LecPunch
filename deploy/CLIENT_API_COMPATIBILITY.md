# Client/API compatibility notes

## Attendance state (2026-09-02)

- `POST /api/attendance/check-in` creates one active session. The database
  partial unique index permits at most one `status: active` session per user.
- `POST /api/attendance/check-out` checks the network policy, then records the
  wall-clock duration from `checkInAt` to the server check-out time. A completed
  session earns one point per fully completed minute.
- An active session reaches its hard limit at five hours and is invalidated.
  Clients warn at four hours and forty-five minutes.
- `GET /api/attendance/team-active` returns every same-team active session that
  is still below the five-hour limit. Display eligibility does not depend on a
  browser, desktop app, or heartbeat being open.

## Points

`GET /api/points/me?week=YYYY-Www` returns `totalPoints`, the requested ISO
`week`, `weekPoints`, `accrualRate`, and `calculatedAt`. Ledger entries are
signed: completed attendance earns one point per fully completed minute, while
an approved shop purchase writes a negative entry. Both all-time and weekly
totals are the sum of the same signed ledger field, so a skin purchase reduces
the displayed balance immediately.

## Skin shop (2026-09-06)

- `GET /api/shop/unlocks` is JWT-authenticated and returns only the caller's
  unlocked skin identifiers: `{ skinIds: string[] }`. It accepts no user or
  team selector.
- `POST /api/shop/unlock` is JWT-authenticated and accepts `{ skinId }`, where
  `skinId` is a 1–64 character URL-safe identifier. A skin costs exactly `600`
  points. The server reads the caller's signed ledger balance, writes one
  `sourceType: "skin_unlock"` ledger entry with `points: -600`, and records the
  caller's unlock in the new `skin_unlocks` collection.
- Repeating the same request is idempotent: an existing unlock (or a recovered
  pre-existing expense after an interrupted request) is returned without a
  second charge. Insufficient balance returns HTTP 400 with
  `code: "SHOP_INSUFFICIENT_POINTS"` and the required/current point values.
- Unlocks are member-scoped. The client must treat the built-in white cat as
  free and must not call the purchase endpoint for it.

## Public GitHub blog sources (2026-09-03)

- `GET /api/github-source/me` and `PUT /api/github-source/me` retain their
  existing response/request fields and add optional `siteUrl`. It is a public
  HTTPS address for the member's human-readable blog site; it may be `null`.
- `GET /api/github-sources/team` is authenticated and returns enabled public
  sources from the caller's team only: `{ items: [{ displayName, repoUrl,
  siteUrl }] }`. `enabled: false` sources are not returned. The response never
  exposes real names, GitHub credentials, branches, index paths, or article
  bodies. Repository and blog addresses are visible to every member in the
  same team.

## Administrator duration adjustments

- A duration adjustment is an auditable weekly correction. It never rewrites a
  real check-in/check-out record and never changes `point_ledger` or
  `GET /api/points/me`.
- `GET /api/attendance/me/weekly-summary?week=YYYY-Www` now uses an **effective
  duration** for `totalFocusedMinutes`: raw completed-session duration plus the
  signed adjustment total for that week, floored at zero. It also returns
  `rawFocusedMinutes`, signed `adjustedMinutes`, `adjustmentsCount`, and the
  member's adjustment entries (including reason and creation time).
- `days[]` remains raw daily attendance. Weekly adjustments deliberately have
  no artificial date, so clients must show a “含管理员调整” marker whenever
  `adjustmentsCount > 0` rather than trying to distribute it among days.
- The three `GET /api/stats/*` endpoints return the same effective value in
  `totalDurationSeconds`, together with `recordedDurationSeconds`,
  `manualAdjustmentSeconds`, and `adjustmentsCount`. Rankings must sort by the
  effective value.
- `GET /api/attendance/admin/weekly-adjustments?week=YYYY-Www` lets a team
  administrator inspect all adjustment entries for that team and week.
- `GET /api/weekly-reports/me?week=YYYY-Www` keeps its existing `week` and
  `item` fields and additionally returns `attendanceSummary`, using the weekly
  summary contract above so a report generator can include adjustment reasons.

## Keepalive compatibility period

`POST /api/attendance/keepalive` remains available for older clients. It is not
part of attendance accounting: it does not resolve client IP, update timestamps,
change duration, or write points. It returns the current active session below the
five-hour limit; no active session returns `ATTENDANCE_NO_ACTIVE_SESSION`, and a
five-hour session is invalidated then returns `ATTENDANCE_SESSION_INVALIDATED`.

New web and Election clients must use `GET /api/attendance/current` and
`GET /api/attendance/team-active` as read-only refreshes instead.

## Network boundary

Only check-in and check-out are network-policy-protected. nginx overwrites
`X-Forwarded-For` with `$remote_addr`; the API trusts one controlled proxy hop.
Clients must never connect directly to MongoDB.

## LAN meeting admission (2026-09-04)

`GET /api/meet/token?room=<name>` is a JWT-authenticated, zero-storage route.
It accepts only a 1–64 character room name composed of letters, numbers,
hyphens, and underscores. It returns `{ token, room, expiresAt,
expiresInSeconds }`; `expiresInSeconds` is 300 (five minutes — invite links
are meant to be used immediately for a meeting happening now). The JWT is
HS256-signed with
the independent `MEET_JWT_SECRET`, has matching `iss`, `aud`, and `sub` values
of `MEET_JWT_APP_ID`, is limited to the requested `room`, and places the
authenticated LecPunch user ID in `context.user.id`. It never accepts a user or
team selector from the client and does not write attendance, duration, points,
or meeting data.

The captain machine must hold the same `MEET_JWT_APP_ID` and
`MEET_JWT_SECRET`; these values are never interchangeable with `AUTH_SECRET`.
