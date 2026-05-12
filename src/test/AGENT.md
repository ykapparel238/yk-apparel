# Test Strategy Guide

## Scope

This folder owns route tests, read-model tests, smoke logic tests, and workflow regressions.

## Testing Philosophy

The repo favors fast, direct, pragmatic tests:
- direct route invocation for API behavior
- mocked Prisma for route logic
- deterministic business-rule tests
- smoke-script logic tests where useful

## Standards

### Route tests
- Mock every Prisma model the route touches.
- If a route adds a new Prisma dependency, update the mock immediately.
- Cover both:
  - success path
  - one or more failure/guard paths

### Read-model tests
- Use them to lock response shape and aggregation behavior.

### Rule tests
- Use them for pure calculations or validation logic.

### Smoke tests
- Keep them non-networked in unit tests.
- Real environment validation belongs in actual script execution outside the test suite.

## Minimum Acceptance After Significant Work

Run:
- `npm test`
- `npm run build`

If release behavior changed, also ensure the scripts still make sense:
- `npm run verify:production`
- `npm run verify:release`

## Common Failure Mode

Most breakages here come from adding new Prisma calls in routes without updating the test mock. Check that first.
