# ADR 0001: Move the API to TypeScript, one module at a time

- Status: accepted
- Date: 2023-03-06
- Author: Chris Lindqvist

## Context

`api/routes.js` has grown to more than 1,000 lines. Every route reads and writes the database
directly, request bodies are camelCase, rows are snake_case and the mapping between the two is
done by hand in several places. Responses mix both styles (books are camelCase, loans and orders
are raw rows). There are no types, so a renamed column is only noticed when a page breaks.

The mobile app team asked for a stable, documented books API. We do not want to break the web
app and the old admin page, which both use `/api/v1`.

## Decision

1. New API code is written in TypeScript under `api/src/v2/`.
2. Only erasable syntax: no `enum`, no `namespace`, no constructor parameter properties, `import
   type` for types. Stripping the types is all it takes to run a file, so there is no build step
   for the API and no `dist/` folder to forget.
3. `/api/v2` starts with the books read endpoints (list, detail, search). Responses are camelCase
   only. Request validation uses zod schemas in `schema.ts`.
4. v1 stays as it is until v2 covers the same features. Then the web app switches over, page by
   page, and v1 is deleted.
5. `routes.js` gets split into `api/routes/<area>.js` files while we go, so the move to
   TypeScript can happen per area.
6. `tsc --noEmit` runs in CI once the first areas are moved.

## Plan

| Step | What | When |
|---|---|---|
| 1 | v2 books read + search, shared types | Q2 2023 |
| 2 | split routes.js into routes/ | Q2 2023 |
| 3 | v2 auth, loans, reservations | Q3 2023 |
| 4 | web app uses v2 for the catalogue | Q4 2023 |
| 5 | delete v1 (keep `/api/books` for the mobile app until it is updated) | 2024 |

## Consequences

- For a while some logic exists twice (v1 and v2). Fixes have to go into both.
- v2 errors use the shape `{ "errors": [{ "path": "...", "message": "..." }] }`, v1 keeps
  `{ "error": "..." }` and `{ "message": "..." }`.
- Editors get type information from `api/tsconfig.json`.
