# Production Runbook

## Environment

Required variables:

- `DATABASE_URL`
- `API_PORT`
- `APP_ORIGIN`
- `CORS_ALLOWED_ORIGINS`
- `TRUST_PROXY`
- `SESSION_TTL_HOURS`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `AUTH_RATE_LIMIT_MAX`
- `APP_URL` for release smoke checks
- `SMOKE_EMAIL`
- `SMOKE_PASSWORD`

Do not enable `ALLOW_PROD_SEED` in normal production operation.

## First Deploy

1. Provision PostgreSQL.
2. Set production env values.
3. Run:
   - `npm install`
   - `npm run db:generate`
   - `npm run db:migrate`
   - `npm run build`
4. Start the API and frontend process.
5. Verify:
   - `GET /api/health`
   - `GET /api/health/db`
   - login works with a real seeded or migrated user
   - `npm run verify:production`
   - `npm run verify:release` if the live stack is already reachable from the release runner

## Migrate

Run:

- `npm run db:migrate`
- `npm run db:generate`

Then restart the API process.

For rehearsal on an existing non-empty database:

- verify `_prisma_migrations` is current before deploy
- run `npm run db:migrate`
- boot the API
- run `npm run verify:production`

## Rollback

1. Roll back the application release first.
2. Restore the database from the latest safe backup if the migration was destructive or incompatible.
3. Re-run `npm run verify:production` after rollback.

Rollback triggers:

- migration applies but app boot fails
- login/session smoke fails
- dashboard, reports, or MRP smoke checks fail
- CSV/PDF export smoke checks fail

## Backup / Restore

Suggested PostgreSQL backup:

- `pg_dump --format=custom --dbname="$DATABASE_URL" --file=backup.dump`

Suggested restore:

- `pg_restore --clean --if-exists --dbname="$DATABASE_URL" backup.dump`

Always verify:

- row counts on critical tables
- login/session flow
- dashboard and reports load without 500 errors

## Release Command Order

For a full release gate on a reachable environment:

1. `npm test`
2. `npm run build`
3. `npm run db:migrate`
4. boot the release candidate
5. `npm run verify:production`
6. `npm run verify:release`

Expected success output:

- tests pass with zero failures
- build completes successfully
- smoke prints `Production smoke checks passed`
- release gate prints `Release verification passed`

## Pre-Deploy Checklist

- `npm test`
- `npm run build`
- `npm run db:migrate`
- `npm run verify:production`
- confirm `APP_URL`, `SMOKE_EMAIL`, and `SMOKE_PASSWORD` point to the target environment
- confirm release runner can reach both API health endpoints and authenticated app routes

## Post-Deploy Checklist

- health and DB readiness both return success
- authenticated reads succeed for session, masters, orders, dashboard, reports, and MRP
- CSV and PDF report downloads succeed
- no 500s on login, dashboard, reports, masters summary, or MRP

## Failure Triage

- If login fails: check DB connectivity, seeded users, and session cookie config
- If dashboard/reports fail: check reporting views and latest migrations
- If masters/orders fail: check enum/schema drift and `_prisma_migrations`
- If MRP reconciliation fails: compare `/api/mrp` with `material-requirement-planning` report output
- If CSV/PDF export fails: check report route registration and content-type headers
