# Route Module Guide

## Scope

This folder contains the API surface for product modules. Each file should act as the authoritative operational contract for its area.

## Route Design Rules

### Keep modules coherent
- `masters.mjs`: master data and style tech pack
- `orders.mjs`: order list/detail/create/edit/delete
- `planning.mjs`: allocation and calendar support
- `production.mjs`: stage/line summaries and production entries
- `inventory.mjs`: stock, shortages, procurement requests, supplier PO, goods receipts
- `qa.mjs`: inspections, defects, CAPA
- `vendors.mjs`: vendor list/detail/challans
- `dispatch.mjs`: shipment lifecycle
- `dashboard.mjs`: executive summary payload
- `reports.mjs`: report catalog and exports
- `mrp.mjs`: shortage calculation
- `settings.mjs`: departments, shifts, users
- `auth.mjs`: login/logout/session
- `assets.mjs`: uploaded asset metadata and access
- `sync.mjs`: desktop sync behavior

### Shared standards
- use zod validation for non-trivial payloads
- use shared error helpers
- use role checks for writes
- add audit logs for meaningful mutations
- prefer explicit mapping helpers over leaking raw Prisma rows

## Domain Rules By Module

### Masters
- style tech-pack data belongs here
- keep style payloads backward compatible
- style assets and samples should remain attached through style ownership

### Orders
- guard quantity and allocation consistency
- detail payload should stay rich enough for operations

### Planning
- do not exceed order quantity
- respect date windows and line capacity

### Production
- production entries are the preferred source for actuals when present
- rejected quantity cannot exceed actual quantity

### Inventory and Procurement
- stock cannot fall below zero or allocated constraints
- shortages should be actionable but controlled
- goods receipts must reconcile supplier PO state and material stock

### QA
- checked, approved, rejected, and rework counts must reconcile
- CAPA should remain tied to real operational context where possible

### Vendors
- challan totals must remain internally valid
- vendor risk indicators should come from live operational quality signals

### Dispatch
- shipment numbering is server-owned
- delivered quantity should reconcile from active shipments
- order status should stay synchronized with shipment totals

### Reports and Dashboard
- use shared reporting helpers where practical
- avoid duplicating analytics logic in multiple routes

## Testing Expectation

Any meaningful route behavior added here should usually have:
- direct route invocation tests
- explicit mock coverage for new Prisma calls
- regression coverage for key failure conditions
