# Server Agent Guide

## Scope

This folder owns:
- app startup
- env validation
- auth/session behavior
- storage helpers
- reporting helpers
- route mounting

`/server/routes` has its own local guide for module-specific route behavior.

## Server Design

The backend is an Express API with:
- session-backed auth
- Prisma persistence
- shared HTTP helpers for success/error responses
- audit logging for important writes
- release-oriented health and smoke support

## Request Lifecycle Expectations

Typical flow:
1. validate env at startup
2. parse request and session
3. enforce auth/role policy
4. validate payload
5. use Prisma or reporting helper
6. write audit log for state changes
7. return shared success/error shape

## Non-Negotiable Backend Rules

### Error contract
- Keep API error responses shaped as:
  - `{ message, code, details }`

### Auth and role policy
- Prefer `requireRoles(...)` for protected writes.
- Treat read-only release/smoke checks carefully.

### Auditing
- Material write operations should generally create an audit log.
- If a route performs multiple DB changes, prefer transactions and pass the transaction client into audit log writes when supported.

### Reporting
- Shared reporting logic belongs in reporting helpers, not duplicated ad hoc inside routes.

### Storage
- File assets are metadata in DB and content in storage.
- Local storage is acceptable for development.
- Production storage should remain configurable.

## Key Files And Their Roles

- `index.mjs`: app wiring and route mount points
- `env.mjs`: runtime env validation
- `auth.mjs`: authentication/session helpers
- `http.mjs`: success/error/async/role helpers
- `audit.mjs`: audit log writer
- `reporting.mjs`: shared analytics and report data shaping
- `storage.mjs`: local and future object-storage behavior
- `style-tech-pack.mjs`: style tech-pack mapping helpers

## Backend Priorities

Prefer work in this order:
1. correctness
2. consistency
3. auditability
4. release safety
5. convenience enhancements

## When Changing Server Behavior

- update the route
- update service/type contracts if payload shape changes
- add or adjust route tests
- update smoke or reporting checks if release behavior changed
