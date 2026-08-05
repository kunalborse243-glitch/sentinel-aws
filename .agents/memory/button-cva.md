---
name: buttonVariants cva pattern
description: Design subagents may write buttonVariants as a plain string; shadcn components expect a cva function
---

## The rule
`buttonVariants` in `button.tsx` MUST be a `cva()` function from `class-variance-authority`, not a plain string.

## Why
Components like `alert-dialog.tsx`, `calendar.tsx`, and `pagination.tsx` call it as `buttonVariants()` or `buttonVariants({ variant: 'outline' })`. A plain string is not callable — TS2349 errors follow.

## How to apply
Whenever a design subagent writes `button.tsx`, check that `buttonVariants` is:
```ts
import { cva, type VariantProps } from "class-variance-authority"
export const buttonVariants = cva("base-classes", { variants: { variant: {...}, size: {...} }, defaultVariants: {...} })
```
`class-variance-authority` is already in the sentinel package.json catalog.
