# Prisma Agent Guide

## Scope

This folder owns:
- `schema.prisma`
- migrations
- seed data

Any change here affects the entire app. Treat schema work as a product-wide decision, not a local patch.

## Responsibilities

The schema should remain the canonical model for:
- operational transactions
- status enums
- reporting inputs
- audit-linked entities
- release-safe migrations

## Modeling Rules

### General
- Prefer additive schema changes over destructive ones.
- Keep naming explicit and consistent with route/domain names.
- Preserve backward compatibility where UI/API payloads already exist.

### Enums
- Route logic must not invent enum values outside the schema.
- If a status is added in code, it must be added in schema and migration in the same change.

### Relations
- Favor explicit ownership:
  - orders own allocations, dispatch, production, QA links
  - styles own tech-pack artifacts
  - procurement requests can lead to supplier POs and goods receipts
- Add indexes where read patterns justify them.

### Numeric fields
- Use decimal/string-backed persistence where precision matters.
- Be careful when route code uses `Number(...)` or `.toFixed(2)` around Prisma decimals.

## Migration Rules

- Every schema change should have a migration.
- Migrations should be safe on non-empty databases where practical.
- Avoid hidden enum drift.
- If a migration introduces new operational tables, seed representative data when appropriate.

## Seed Rules

- Seed should support:
  - login
  - masters summary
  - order/planning/procurement/production/QA/dispatch/report flows
- Seed should stay deterministic enough for reconciliation tests.
- Asset-related seed may use metadata-only records; do not require real binaries.

## Current Key Domains

Operational entities already in scope:
- users, departments, shifts, sessions
- brands, suppliers, vendors, styles, materials, BOM, lines
- purchase orders, planning allocations, vendor challans
- procurement requests, supplier purchase orders, goods receipts
- production entries, downtime reasons
- QA inspections, defects, corrective actions
- dispatch shipments
- file assets, style samples, measurements, thread specs

## Common Failure Modes

- enum mismatch between schema and route logic
- migration missing for a new status or table
- seed assumes data that no longer matches schema
- test mocks treat decimal-like fields as strings in one place and numbers in another

## Before You Finish Schema Work

Run:
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`

Then verify:
- `npm test`
- `npm run build`
