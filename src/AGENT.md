# Frontend Agent Guide

## Scope

This folder owns the React app, route pages, shared services, types, contexts, and UI composition.

## Frontend Goal

Keep the UI visually stable while increasing operational depth. Most work should feel like the current product became smarter, not like it was redesigned.

## Frontend Architecture

- route pages live in `/src/pages`
- API/service and type contracts live in `/src/lib`
- app shell and layout primitives live in `/src/components`
- React Query is the main server-state layer
- React Hook Form + Zod is the standard for non-trivial forms

## UI Rules

- Reuse existing tables, cards, sheets, and dialogs.
- Add actions inside the current page rather than inventing new navigation.
- Preserve dense manufacturing-operations information layout.
- Keep loading, empty, and error states practical and explicit.

## State Rules

- Server state should come from query hooks and service helpers.
- Avoid duplicating derived server truth in too many local states.
- Use invalidation deliberately after mutations.

## Behavioral Priorities

1. keep workflows complete
2. keep payloads accurate
3. keep forms resilient
4. keep the UI familiar

## Local Guides

Read these when working deeper:
- `/src/pages/AGENT.md`
- `/src/lib/AGENT.md`
- `/src/test/AGENT.md`
