# Scripts Agent Guide

## Scope

This folder owns operational scripts for:
- desktop development helpers
- diagnostics
- release verification
- production smoke checks

## Script Philosophy

Scripts should make releases and diagnosis safer, not more magical.

## Key Scripts

- `production-smoke.mjs`
  - read-only production-oriented smoke checks
  - verifies health, DB readiness, auth, masters, orders, dashboard, reports, MRP, and other critical reads

- `verify-release.mjs`
  - top-level release gate
  - composes test, build, and smoke readiness

- desktop scripts
  - support local desktop workflow and diagnostics

## Rules

- Keep smoke verification read-only toward live environments.
- Fail loudly and specifically so triage is fast.
- If a new critical module becomes launch-sensitive, add it to smoke checks.
- Keep docs and scripts aligned; do not let runbooks drift away from actual commands.

## When Updating Scripts

Update smoke/release checks when:
- a new critical endpoint is introduced
- a payload contract required by operations changes
- release assumptions change

Then update:
- `/docs/production-runbook.md`
- root `/AGENT.md` if the release story changed materially
