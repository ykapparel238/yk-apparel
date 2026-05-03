# Desktop Release Flow

## Release model
- Desktop releases are manual in Phase 1.
- Use GitHub Actions `Desktop Release` with `workflow_dispatch`.
- Do not auto-publish installers on every commit.

## Before triggering a release
1. `npm test`
2. `npm run build`
3. `npm run desktop:doctor-check`
4. `npm run test:desktop:integration`
5. Confirm support tooling works with a real local desktop database.

## GitHub release workflow inputs
- `release_tag`: version tag such as `desktop-v1.0.0`
- `release_name`: human-readable title
- `draft`: keep draft enabled until smoke validation completes

## What the workflow builds
- macOS `.dmg`
- Windows `.exe` via NSIS

## Rollout guidance
- Start with a small controlled cohort.
- Confirm bundle sync health and conflict handling on real devices.
- Keep releases manual until offline operations stay stable across several cycles.
