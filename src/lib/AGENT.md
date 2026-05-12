# Shared Library Guide

## Scope

This folder owns:
- API calling helpers
- service functions
- shared frontend types
- desktop bridge and offline helpers

## Contract Rules

### `types.ts`
- This is the frontend contract layer.
- Keep payloads aligned with route responses.
- Prefer extending types carefully over breaking older consumers.

### `services.ts`
- Centralize page-facing API access here.
- New routes should usually get a corresponding service helper.
- Keep fetch wrappers thin and predictable.

### `api.ts`
- Shared request handling should stay generic.
- Do not bury domain behavior here.

### Desktop helpers
- Desktop bridge and repository code should remain isolated from normal page behavior.
- Sync-related changes should not silently break browser-only behavior.

## Type Design Rules

- Prefer explicit operational names over generic `data` shapes.
- For list/detail pairs, keep a readable distinction.
- When adding optional fields, document the expectation in route behavior and page usage.

## When Updating Shared Contracts

1. update types
2. update service helper
3. update consuming page
4. update tests if behavior changed
