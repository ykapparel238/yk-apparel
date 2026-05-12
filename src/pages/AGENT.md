# Pages Agent Guide

## Scope

This folder contains end-user operational screens. Each page should remain the primary working surface for its module.

## Page-Level Design Rules

- Keep page structure stable.
- Prefer extending existing dialogs and sections.
- Avoid adding new top-level pages unless the current page cannot reasonably hold the workflow.

## Page Responsibilities

### Login
- auth entry point only

### Masters
- brands, suppliers, vendors, styles
- materials, BOM items, lines
- style tech-pack editing and upload actions

### Orders
- list-level create/edit/delete
- order allocations and lifecycle visibility

### OrderDetail
- operational single-order context
- BOM, challans, and style tech pack should be visible here
- reuse list-level mutations where possible instead of duplicating business logic

### Planning
- planning board and allocation workflows

### Calendar
- read-model planning capacity view

### Production
- stage and line read views
- production actual entry/correction

### Vendors and VendorDetail
- vendor summary and challan operations
- quality risk and open CAPA visibility

### Inventory
- material visibility
- stock adjustments
- shortage visibility
- procurement requests, supplier PO, goods receipt actions

### QA
- inspections
- defects
- CAPA

### Dispatch
- shipment create/edit/correction
- balance and shipment history

### Dashboard
- management metrics

### Reports
- report catalog
- detail rows
- CSV/PDF exports
- MRP, forecast, wastage, and risk views

### Settings
- departments
- shifts
- users

## Form Rules

- Zod schemas should define form rules when forms are complex.
- Submit buttons should disable while mutations are active.
- Preserve selected values reliably across edits.
- Surface backend validation errors through the existing toast/dialog pattern.
