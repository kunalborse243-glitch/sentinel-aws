---
name: OpenAPI codegen fixes for Zod v3 + Orval v8
description: Known incompatibilities between OpenAPI 3.1 features and the workspace's Zod v3 + Orval v8 setup
---

## Rules
1. **No `type: integer`** — use `type: number` instead. Zod v3 has no `.int()` method; Orval v8 emits it for integer types, breaking compilation.
2. **No `format: email`** — Zod v3 has no `.email()` shorthand in the generated path Orval uses. Remove the format annotation.
3. **No `nullable: true`** — use `type: ["string", "null"]` (OpenAPI 3.1 style) instead.
4. **Avoid query-param names that match operation IDs** — Orval generates a `<OperationId>Params` type for query params AND a `<OperationId>Params` type for path params; collision causes TS2308 export errors. Move the param to the path instead of the query string.
5. **No `metadata: { type: object }`** — use `metadataJson: { type: ["string", "null"] }` (store as serialized JSON string).

**Why:** The workspace uses Zod v3 (not v4) and Orval v8 which generates Zod v4-style methods when modern OpenAPI features are used.
