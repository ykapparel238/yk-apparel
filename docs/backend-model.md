# Backend Model

## Current Backend Shape

The backend is an Express + Prisma API for the YK Apparels workflow. It is no longer a planned mock replacement; the core operational modules are implemented against PostgreSQL with route-level tests.

## Implemented Domains

- Foundation: users, departments, shifts, sessions, audit logs, health checks, release smoke checks.
- Masters: brands, suppliers, vendors, styles, materials, BOM items, production lines.
- Style tech packs: file assets, samples, measurement specs, thread specs, colorway metadata.
- Orders: purchase orders, size allocations, color allocations, detail payloads.
- Planning: production plans, calendar read models, capacity guardrails.
- Inventory and procurement: stock adjustments, procurement requests, supplier purchase orders, goods receipts.
- Production: stage/line read models, production entries, downtime reasons.
- QA: inspections, defect rows, defect types, corrective actions.
- Vendors: vendor list/detail, challans, scorecards, CAPA/risk indicators.
- Dispatch: shipments, correction lifecycle, delivered quantity/status reconciliation.
- Reporting: dashboard, report catalog, CSV/PDF export, MRP, procurement, production actuals, CAPA, tech-pack register, forecast/wastage, risk watchlist.
- Desktop sync: offline bundle/checkpoint/conflict support.

## API Groups

- `/api/auth`
- `/api/health` and `/api/health/db`
- `/api/masters`
- `/api/assets`
- `/api/orders`
- `/api/planning`
- `/api/production`
- `/api/vendors`
- `/api/inventory`
- `/api/qa`
- `/api/dispatch`
- `/api/settings`
- `/api/dashboard`
- `/api/reports`
- `/api/mrp`
- `/api/sync`

## Operational Rules

- API errors use `{ message, code, details }`.
- Meaningful writes should be audited.
- Multi-record mutations should use Prisma transactions.
- Status values must stay aligned with Prisma enums.
- Report/dashboard logic should prefer shared reporting helpers.
- File metadata is stored in PostgreSQL; file binaries are stored in local disk or S3-compatible storage.

## Setup

For local development:

1. Configure `.env`.
2. Run `npm install`.
3. Run `npm run db:setup`.
4. Run `npm run dev:local`.

For production verification:

1. Run `npm run lint`.
2. Run `npm test`.
3. Run `npm run build`.
4. Run `npm run db:migrate`.
5. Boot the app.
6. Run `npm run verify:production`.
7. Run `npm run verify:release`.
