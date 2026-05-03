# KnitCraft Desktop Local Runtime

## What lives locally
- Offline snapshots for Orders, Planning, Inventory, QA, and Dispatch.
- Pending bundle queue in SQLite.
- Mutation outbox, pull checkpoints, sync runs, conflicts, and dead letters.
- Cached desktop session bootstrap for reopening the app offline after a successful online login.

## Local database
- Path: `~/Library/Application Support/vite_react_shadcn_ts/offline-knitcraft.db`
- Main tables:
  - `local_snapshots`
  - `sync_bundles`
  - `outbox_mutations`
  - `pull_checkpoints`
  - `sync_runs`
  - `sync_conflicts`
  - `sync_dead_letters`
  - `client_state`

## Daily operator commands
- `npm run desktop:doctor-check`
- `npm run desktop:cohort-health`
- `npm run desktop:trace-sync -- --bundle <bundleId>`
- `npm run desktop:trace-sync -- --mutation <mutationId>`
- `npm run desktop:trace-sync -- --device <deviceId>`
- `npm run desktop:export-diagnostics`
- `npm run desktop:verify-rebuild`

## Expected runtime rules
- Desktop reads from local snapshots first.
- Desktop writes immediately to local SQLite and queues bundle mutations.
- Push is bundle-atomic.
- Pull uses checkpoint-based sync with explicit rebuild handling.
- `RESTRICTED` desktops are read-only.
- `LOCKED` and `REVOKED` desktops cannot queue writes or continue sync.
