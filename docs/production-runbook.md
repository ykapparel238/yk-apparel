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

## Migrate

Run:

- `npm run db:migrate`
- `npm run db:generate`

Then restart the API process.

## Rollback

1. Roll back the application release first.
2. Restore the database from the latest safe backup if the migration was destructive or incompatible.
3. Re-run health checks after rollback.

## Backup / Restore

Suggested PostgreSQL backup:

- `pg_dump --format=custom --dbname="$DATABASE_URL" --file=backup.dump`

Suggested restore:

- `pg_restore --clean --if-exists --dbname="$DATABASE_URL" backup.dump`

Always verify:

- row counts on critical tables
- login/session flow
- dashboard and reports load without 500 errors

## Pre-Deploy Checklist

- `npm test`
- `npm run build`
- `npm run db:migrate`
- `npm run verify:production`

## Post-Deploy Checklist

- health and DB readiness both return success
- authenticated reads succeed for masters, orders, dashboard, and reports
- no 500s on login, dashboard, reports, or masters summary

## Failure Triage

- If login fails: check DB connectivity, seeded users, and session cookie config
- If dashboard/reports fail: check reporting views and latest migrations
- If masters/orders fail: check enum/schema drift and `_prisma_migrations`
