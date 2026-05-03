# Desktop Support Runbook

## First checks
1. Run `npm run desktop:doctor-check`.
2. Run `npm run desktop:cohort-health`.
3. Export diagnostics with `npm run desktop:export-diagnostics`.
4. Trace the affected sync object:
   - `npm run desktop:trace-sync -- --bundle <bundleId>`
   - `npm run desktop:trace-sync -- --mutation <mutationId>`
   - `npm run desktop:trace-sync -- --device <deviceId>`

## How to read desktop states
- `valid`: normal read/write desktop use.
- `restricted`: local read-only mode. Sync may still pull server changes.
- `locked`: do not allow unlock or write/sync progression.
- `rebuildRequired`: desktop must rebuild cache before normal work continues safely.

## Common cases
### Conflicts
- Open the desktop `Sync Issues` panel.
- Review local and server snapshots side by side.
- Choose `Keep Local`, `Keep Server`, or `Dismiss`.
- Add rationale before resolving when possible.

### Rebuild required
- Confirm with `npm run desktop:verify-rebuild`.
- Use `Rebuild Cache` in the desktop sync panel.
- Re-run `npm run desktop:verify-rebuild`.

### Repeated failed bundles
- Check `deadLetters` and `failedBundles` in diagnostics.
- Retry from the sync panel first.
- If bundles move to dead-letter, inspect them with `desktop:trace-sync`.
- Fix the validation or reference-data problem before reattempting writes.

### Locked or revoked device
- Open Settings in the web/admin app.
- Find the device in `Desktop Devices`.
- Set status back to `ACTIVE` only after confirming the device should regain access.

## Escalation bundle for engineering
- Device id
- Bundle id or mutation id
- Exported diagnostics JSON
- Whether rebuild was required
- Current desktop access state
- User-visible error message
