# KnitCraft MES Agent Guide

## Purpose

This repository is a knitwear manufacturing execution system with:
- a Vite + React frontend in `/src`
- an Express + Prisma API in `/server`
- a PostgreSQL schema and seed in `/prisma`
- release and smoke scripts in `/scripts`

This file is the root operating manual for any future coding agent. Local `AGENT.md` files in subfolders refine the guidance for their area.

## Product Goal

The app should be production-ready for day-to-day knitwear operations without redesigning the current UI. Work should deepen correctness, workflow completeness, reporting trust, and release safety before expanding into speculative features.

## Primary Business Flow

The intended business flow is:
1. maintain masters for brands, suppliers, vendors, styles, materials, BOM, and lines
2. define style tech packs with colorways, measurements, thread specs, samples, and attachments
3. create purchase orders tied to brand and style
4. allocate orders in planning and capacity views
5. act on MRP shortages through procurement requests, supplier POs, and goods receipts
6. record production execution by line, stage, date, and shift
7. inspect output in QA and track CAPA where issues recur
8. manage vendor challans for outsourced processes
9. dispatch finished goods with shipment corrections and auditability
10. review dashboard, reports, MRP, forecast, wastage, and risk outputs

## Architecture At A Glance

Frontend:
- React 18 with route pages in `/src/pages`
- React Query for server state
- React Hook Form + Zod for forms
- shared API/types in `/src/lib`
- existing UI system is shadcn/radix-based and should be preserved

Backend:
- Express routes in `/server/routes`
- Prisma ORM with PostgreSQL
- session-backed auth
- shared error contract via server HTTP helpers
- audit logging on meaningful writes
- release checks via smoke scripts

Persistence:
- Prisma schema is the system of record
- migrations must stay aligned with enums and route behavior
- seed data should remain deterministic enough for tests and reconciliation

## Non-Negotiable System Rules

### UI and UX
- Do not redesign the app unless explicitly asked.
- Reuse existing tables, cards, dialogs, and action layouts.
- Add operational depth inside current screens before creating new screens.
- Favor dense, practical manufacturing UI over decorative changes.

### API and Validation
- Keep the shared JSON error shape:
  - `{ message, code, details }`
- New writes should have:
  - role checks
  - validation
  - audit logs
  - transaction boundaries where multiple records change together

### Data Integrity
- Never introduce a status in route/UI logic that is missing from the Prisma schema.
- Keep order, dispatch, production, QA, procurement, and reporting state transitions consistent.
- Prefer recalculation from canonical rows over hidden derived mutations.

### Reporting
- Dashboard and report metrics should flow through shared reporting helpers whenever possible.
- Reconciliation is more important than cosmetic chart expansion.

### Testing
- Route-level tests are a first-class standard in this repo.
- New workflow depth should ship with tests.
- `npm test` and `npm run build` should remain green after each meaningful slice.

## Current Delivery Strategy

The repo is beyond demo stage and should be treated as an operational product. The order of implementation should be:
1. close correctness gaps
2. close workflow gaps
3. expand reporting trust
4. harden release verification
5. only then expand post-MVP intelligence

## Module Status Snapshot

### Foundation and Access
- Status: `partially_done`
- In place:
  - session auth
  - rate limiting
  - env validation
  - health and DB readiness
  - release smoke commands
- Still important:
  - live deployed verification discipline

### Master Data
- Status: `partially_done`
- In place:
  - brands, suppliers, vendors, styles
  - materials, BOM items, production lines
  - style tech pack and uploads
- Still important:
  - richer admin depth only if business needs it

### Order Management
- Status: `partially_done`
- In place:
  - create/edit/delete
  - detail view
  - size/color allocation editing
  - tech pack visibility in order detail
- Still important:
  - live release verification

### Planning and Capacity
- Status: `partially_done`
- In place:
  - planning board
  - calendar
  - production entry capture
- Still important:
  - deeper production analytics from actuals over time

### Vendor Management
- Status: `partially_done`
- In place:
  - challans
  - vendor scorecards
  - CAPA visibility
- Still important:
  - broader vendor lifecycle if required

### Inventory and Procurement
- Status: `partially_done`
- In place:
  - stock adjustments
  - shortage requests
  - supplier PO creation
  - goods receipts
- Still important:
  - broader supplier purchasing workflows if needed

### QA
- Status: `partially_done`
- In place:
  - inspections
  - defects
  - CAPA
- Still important:
  - broader integration and historical analysis

### Dispatch
- Status: `partially_done`
- In place:
  - create/edit/correct shipment lifecycle
  - remaining balance and shipment history
- Still important:
  - live environment verification

### Settings
- Status: `partially_done`
- In place:
  - departments
  - shifts
  - users
- Still important:
  - broader admin depth only if necessary

### Dashboard, Reports, MRP, Forecasting
- Status: `partially_done`
- In place:
  - centralized dashboard reporting
  - CSV and PDF exports
  - MRP in reports
  - procurement, production, CAPA reports
  - forecast and risk watchlist reports
- Still important:
  - deeper calibration and live reconciliation

## Cross-Cutting Invariants By Domain

### Orders
- `deliveredQty` must never exceed `quantity`
- order status must reflect actual workflow progress
- size and color allocations must stay internally valid

### Dispatch
- shipment numbering is server-owned
- delivered totals should reconcile from active shipments
- partial shipment should not over-complete an order

### Procurement
- shortage requests should map cleanly into supplier PO flows
- goods receipts must increase material stock
- procurement request closure should reflect receipt completion

### Production
- rejected quantity cannot exceed actual quantity
- execution entries should be the preferred source for line and stage actuals

### QA and CAPA
- inspection totals must reconcile
- defect rows should stay tied to inspections
- CAPA should remain tied to a real operational context where possible

### Style Tech Pack
- assets are metadata in DB and files in storage
- styles should remain backward compatible with older simple payloads
- order detail should consume style tech-pack data without duplicating style ownership

## How To Work In This Repo

When implementing:
1. inspect the relevant local `AGENT.md`
2. update schema before routes if data shape changes
3. update services/types with routes
4. wire UI without redesign
5. add or update tests
6. run `npm test`
7. run `npm run build`
8. update this tracker if scope meaningfully changed

When fixing a production issue:
1. identify whether it is env, schema, route, reporting, or UI
2. prefer the smallest correct fix
3. add a regression test when practical
4. document the behavior if it affects release or operations

## Release Readiness Gate

A release should aim to pass:
- `npm test`
- `npm run build`
- `npm run verify:production`
- `npm run verify:release`

The last two require a running stack and should remain read-only toward production data.

## Deferred Scope

These are not launch blockers unless explicitly made so by the business:
- advanced procurement/accounting
- full vendor orchestration beyond current challan and scorecard depth
- forecasting model science beyond current heuristics
- wastage calibration beyond current report logic
- advanced risk scoring and optimization engines

## Local Agent Map

Read these when working in those folders:
- `/prisma/AGENT.md`
- `/server/AGENT.md`
- `/server/routes/AGENT.md`
- `/src/AGENT.md`
- `/src/pages/AGENT.md`
- `/src/lib/AGENT.md`
- `/src/test/AGENT.md`
- `/scripts/AGENT.md`
