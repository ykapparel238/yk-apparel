# Backend Model

## Entity list

- `Department`, `Shift`, `User`
- `Brand`, `Style`, `StyleSize`, `StyleColor`
- `Supplier`, `Material`, `BillOfMaterialItem`
- `Vendor`, `VendorChallan`, `VendorWeeklyMetric`
- `ProductionLine`, `ProductionPlan`, `StageDailyMetric`, `LineDailyMetric`
- `PurchaseOrder`, `PurchaseOrderSizeAllocation`, `PurchaseOrderColorAllocation`
- `QaDefectType`, `QaInspection`, `QaInspectionDefect`
- `DispatchShipment`, `AuditLog`, `Alert`

## API endpoints/actions needed by current UI

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`
- `GET /dashboard/summary`
- `GET /dashboard/alerts`
- `GET /orders`, `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id`, `DELETE /orders/:id`
- `GET /orders/:id/bom`, `GET /orders/:id/challans`
- `GET /planning/board`, `GET /planning/calendar`, `POST /plans`, `PATCH /plans/:id`
- `GET /production/stages`, `GET /production/lines`
- `GET /vendors`, `POST /vendors`, `GET /vendors/:id`, `PATCH /vendors/:id`
- `GET /vendors/:id/challans`, `POST /challans`, `PATCH /challans/:id`
- `GET /inventory/materials`, `PATCH /inventory/materials/:id`
- `GET /qa/summary`, `GET /qa/defects`, `GET /qa/vendor-trends`, `POST /qa/inspections`
- `GET /dispatch/orders`, `POST /dispatch/shipments`
- `GET /masters/brands`, `GET /masters/styles`, `GET /masters/suppliers`, `GET /masters/vendors`
- `GET /settings/departments`, `GET /settings/shifts`, `GET /settings/users`, `GET /settings/audit-log`

## Migration/seed plan

1. Copy `.env.example` to `.env` and point `DATABASE_URL` at PostgreSQL.
2. Run `npm install`.
3. Run `npm run db:generate`.
4. Apply `prisma/migrations/0001_init/migration.sql` or run `npm run db:migrate`.
5. Run `npm run db:seed`.
6. Replace frontend `mockData` reads module-by-module with API calls against the schema above.

## Notes

- The schema is intentionally shaped around the current screens.
- Dashboard, calendar, QA, and vendor trend views are supported through operational tables plus lightweight reporting snapshots.
- No frontend visuals or component structure need to change for the backend to fit.
