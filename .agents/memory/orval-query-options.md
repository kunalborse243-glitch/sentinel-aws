---
name: Orval query options TanStack Query v5
description: How to pass partial query options to Orval-generated hooks without TS2741 queryKey errors
---

## The problem
TanStack Query v5's `UseQueryOptions` requires `queryKey`. Orval-generated hooks accept `{ query?: UseQueryOptions<...> }` as the options arg. Passing only `{ enabled, refetchInterval }` triggers TS2741: "Property 'queryKey' is missing".

## The fix
Cast the partial options object with `as any`:
```ts
useGetMe({ query: { enabled: !!token, retry: false } as any })
useGetScan(id, { query: { enabled: !!id, refetchInterval: (d: any) => ... } as any })
```

**Why:** The generated function merges in the correct `queryKey` internally — the partial object is safe at runtime. The cast suppresses the TS complaint without suppressing actual type errors on the returned data.

## How to apply
Any time a hook is called with only `enabled` / `refetchInterval` / `retry` in the `query` option, add `as any`.
