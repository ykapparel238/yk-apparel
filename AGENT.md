# Implementation Context

## Goal

Implement the product module by module without changing the current UI design.

## Tracker Model

Checklist per module:
- Data model
- API routes
- UI list page
- UI detail page
- Create/edit/delete actions
- Validation
- Loading/error/empty states
- Seed data
- Tests
- Reporting impact

Status values:
- `not_started`
- `in_progress`
- `partially_done`
- `done`
- `post_mvp`

## Module Order

1. Foundation and Access
2. Master Data
3. Order Management
4. Planning and Capacity
5. Vendor Management
6. Inventory and Procurement
7. QA
8. Dispatch
9. Settings
10. Dashboard
11. Reports
12. MRP MVP
13. Forecasting / Wastage / Risk

## Module Status

### 1. Foundation and Access
- Status: `partially_done`
- Pages: Login
- Done:
  - login wired
  - session-backed auth foundation added
  - PostgreSQL + Prisma base schema added
  - initial reporting views added
  - API/client plumbing added
  - production build verified after module updates
  - secure session cookie behavior now varies by environment
  - last active timestamps update from auth/session usage
  - health and DB readiness endpoints added
  - shared server error contract and role-policy layer added
  - initial automated tests added for client/server contract helpers
  - auth login now has rate limiting
  - request and error logging added for server operations
  - env validation now covers app origin, CORS, proxy trust, session TTL, and auth throttling config
  - route-level auth tests now cover login, logout, and active session flows
  - release verification scripts now exist for live smoke and full release gating
- Left:
  - continue verifying against real deployed environments

### 2. Master Data
- Status: `partially_done`
- Pages: Masters
- Done:
  - `/api/masters` routes added
  - Masters page switched from mock data to API-backed sections
  - create/edit/delete dialogs added for brands, suppliers, vendors, styles
  - order creation now depends on real brand/style master data
  - production build verified with Masters module wired
  - audit logging now covers brand, supplier, vendor, and style create/update/delete flows
  - master write routes now use the shared error contract
  - business-rule tests added for master-data helper logic
  - materials, BOM items, and production lines are now DB-backed in the existing Masters screen
  - materials, BOM items, and lines now support create/edit/delete with validation and audit logging
  - masters options payload now supplies the reference data needed for BOM/material workflows
  - route-level tests now cover material validation, duplicate BOM prevention, and line delete guards
- Left:
  - more advanced master-data admin actions beyond current screen scope

### 3. Order Management
- Status: `partially_done`
- Pages: Orders, OrderDetail
- Done:
  - orders list wired
  - order create wired
  - order detail wired
  - PO uniqueness and brand/style consistency validated on the API
  - default size/color allocations now persist from the selected style
  - order edit/delete UI wired in the existing Orders screen
  - order update/delete API endpoints added
  - size/color allocation editing is now supported in the existing Orders sheet
  - order create/update/delete writes now create audit log entries
  - order write routes now use the shared error contract
  - business-rule tests added for order normalization and allocation validation
  - route-level tests now cover order creation audit flow and invalid delivered-vs-quantity lifecycle updates
- Left:
  - no major gaps in current MVP scope; continue with live deploy verification

### 4. Planning and Capacity
- Status: `partially_done`
- Pages: Planning, Calendar, Production
- Done:
  - planning board wired
  - calendar wired
  - production page wired
  - create/update plan actions wired in the existing Planning board
  - planning API now validates line capacity, due-date windows, and duplicate allocations
  - planning writes now create audit log entries
  - planning validation now blocks planned quantity beyond order quantity
  - business-rule tests added for planning date window calculations
  - route-level tests now cover quantity guardrails and create-plan audit/status transitions
  - Production page now supports actual production entry create/edit flows in the existing dialog pattern
  - production entry APIs now cover stage, line, shift, planned, actual, rejected, downtime, reason, and remarks
  - stage and line read models now prefer real production-entry aggregates when live execution data exists
  - route-level tests now cover production entry creation alongside existing production read coverage
- Left:
  - no major gaps in current MVP scope; continue with live deploy verification

### 5. Vendor Management
- Status: `partially_done`
- Pages: Vendors, VendorDetail
- Done:
  - vendor list page wired to real API data
  - vendor detail page wired to challans and weekly metrics
  - issue challan flow added on the vendor detail screen
  - challan inward/rejection update flow added
  - route-level tests now cover challan totals validation and closed-state update flow
  - vendor detail now surfaces CAPA counts and quality risk signals from live QA corrective actions
- Left:
  - broader vendor lifecycle coverage

### 6. Inventory and Procurement
- Status: `partially_done`
- Pages: Inventory
- Done:
  - `/api/inventory` route added
  - Inventory page switched from mock stock/material data to DB-backed materials
  - stock adjustment workflow added with validation and audit logging
  - route-level tests now cover negative/allocated stock guards and successful stock adjustment writes
  - shortage-driven procurement requests are now supported with create/update APIs and audit logs
  - Inventory screen now shows shortage and procurement request state in the existing table layout
  - procurement request list is now visible in Inventory using the existing table/card patterns
  - supplier purchase orders are now supported with create/update APIs in the existing Inventory workflow
  - goods receipt posting now updates PO receipt progress, closes procurement when fully received, and increases material stock
  - Inventory page now shows supplier PO state and receive-stock actions without introducing a new screen
  - route-level tests now cover supplier PO creation and goods receipt stock reconciliation
- Left:
  - broader supplier purchasing workflows beyond operational PO and receipt tracking

### 7. QA
- Status: `partially_done`
- Pages: QA
- Done:
  - `/api/qa` route added
  - QA page switched from mock summaries/defects/vendor quality to DB-backed data
  - inspection create workflow added
  - inspection edit workflow added through the existing QA dialog shell
  - QA writes now use validation, role checks, shared error codes, and audit logs
  - route-level tests now cover invalid dates, invalid totals, defect persistence, update flow, and summary payload shape
  - CAPA create/update workflow added in the existing QA screen
  - QA payload now includes CAPA items and vendor-level open CAPA counts
  - route-level tests now cover CAPA create/update behavior
- Left:
  - broader integration coverage beyond route-level tests

### 8. Dispatch
- Status: `partially_done`
- Pages: Dispatch
- Done:
  - `/api/dispatch` route added
  - Dispatch page switched from mock readiness data to DB-backed orders
  - shipment creation flow added and updates delivered quantity/status
  - dispatch writes now use role checks, error codes, and audit logs
  - shipment edit flow added in the existing dispatch dialog
  - route-level tests now cover status filtering, invalid dates, over-dispatch rejection, create flow, and shipment update recalculation
  - dispatch route tests now cover full-delivery transition to `DISPATCHED`
  - shipment status lifecycle now supports ready/scheduled/dispatched/cancelled updates in the existing dialog
  - dispatch list now shows remaining balance and shipment history in the existing UI pattern
  - shipment cancellation/correction now recalculates delivered quantity from active shipments only
- Left:
  - no major gaps in current MVP scope; continue with live deploy verification

### 9. Settings
- Status: `partially_done`
- Pages: Settings
- Done:
  - `/api/settings` route added
  - Settings page switched from mock departments, shifts, users, and audit log to DB-backed data
  - edit flows added for departments, shifts, and users
  - settings writes now audited and role-restricted
  - settings forms now disable controls while save mutations are pending
  - route-level tests now cover department validation, shift not-found handling, user reference validation, user update audit logging, and admin-only write protection
  - settings read-model tests now cover persisted list payload shape
- Left:
  - broader admin coverage

### 10. Dashboard
- Status: `partially_done`
- Pages: Dashboard
- Done:
  - `/api/dashboard` route added
  - Dashboard page switched from mock KPI/chart/table data to DB-backed summaries
  - dashboard payload now reads through centralized reporting logic instead of separate ad hoc route aggregation
  - dashboard route regression coverage added
  - exact dashboard KPI reconciliation tests now assert deterministic seeded-style totals
  - live release reconciliation now verifies dashboard totals against orders and management summary outputs
- Left:
  - continue moving remaining metrics toward reporting-view-only sources where beneficial

### 11. Reports
- Status: `partially_done`
- Pages: Reports
- Done:
  - `/api/reports` route added
  - Reports page switched from static cards to DB-backed report availability counts
  - real report detail endpoints and CSV export endpoints added
  - PDF export endpoints added for the same report catalog
  - MRP shortage visibility is now surfaced inside the Reports screen
  - report-side MRP rows now reflect active procurement request state
  - route-level tests now cover report summary, detail, CSV export, and PDF export flows
  - release smoke now verifies report summary, CSV export, and PDF export in a live stack
  - procurement status, production actuals, and CAPA closure reports are now part of the shared reporting catalog
- Left:
  - continue with reconciliation and live deploy verification

### 12. MRP MVP
- Status: `partially_done`
- Pages: none yet
- Done:
  - `/api/mrp` route added
  - BOM vs free-stock shortage calculation exposed for later dashboard/report use
  - MRP shortage data is now visible in the Reports UI
  - dedicated MRP calculation tests added
  - MRP rows now expose active procurement request state so shortages can be actioned safely
  - forecast/wastage and order-risk report outputs are now available through the existing Reports catalog
  - release smoke now reconciles `/api/mrp` totals against the MRP report output
- Left:
  - deeper reconciliation coverage

### 13. Forecasting / Wastage / Risk
- Status: `partially_done`
- Pages: Reports
- Done:
  - forecast and wastage model report added using risk-adjusted MRP outputs
  - order risk watchlist report added using due-date, shortage, vendor-pending, and progress signals
  - these analytical views are exposed without adding a new screen by extending the existing Reports catalog
- Left:
  - deeper model calibration if the business wants production-grade planning science beyond current heuristics
- Pages: none yet

### 14. Style Tech Pack and Uploads
- Status: `partially_done`
- Pages: Masters, OrderDetail
- Done:
  - style tech-pack schema added with `FileAsset`, `StyleSample`, `StyleSampleAsset`, `StyleMeasurementSpec`, and `StyleThreadSpec`
  - upload/storage env contract added with local development storage
  - `/api/assets` route added for asset create/read/delete
  - `/api/masters/styles/:id/tech-pack` read/update endpoints added
  - `/api/masters/styles/:id/samples` create/update endpoints added
  - `/api/masters/styles/:id/assets` attach/delete endpoints added
  - Masters style row `Tech pack` action now opens a real editor dialog for assets, sample specs, measurements, thread specs, and colorway metadata
  - Order detail payload now includes `techPack`, and `OrderDetail` renders assets, samples, thread specs, colorways, and measurement chart
  - seeded sample tech-pack metadata added for representative styles
  - route-level tests added for assets, tech-pack reads/updates, style sample creation, and order-detail tech-pack payload
- Left:
  - production object-storage wiring and live upload verification still need real-environment confirmation
  - run the new migration locally and seed again in a real DB
  - wire S3-compatible production storage beyond the local-driver fallback
  - optionally add stronger image preview/fallback behavior for missing seed files in non-uploaded environments

## Page Mapping

- Login: implemented
- Orders: implemented
- OrderDetail: implemented
- Planning: implemented
- Calendar: implemented
- Production: implemented
- Masters: implemented
- Vendors: pending
- Vendors: implemented
- VendorDetail: implemented
- Inventory: implemented
- QA: implemented
- Dispatch: implemented
- Settings: implemented
- Dashboard: implemented
- Reports: implemented

## Working Rules

- Preserve styling exactly.
- Keep changes scoped to the active module.
- Reuse existing components/screens.
- Replace mock data only for the active module and its direct dependencies.
- Leave unrelated modules mocked until their turn.
