---
name: Sentinel AWS stack
description: Stack choices and structure for the Sentinel AWS security auditing SaaS
---

## Stack
- Frontend: `artifacts/sentinel` — React Vite, TailwindCSS, Wouter routing, Recharts, Framer Motion, Sonner toasts, react-hook-form + Zod
- Backend: `artifacts/api-server` — Express, AWS SDK v3 (IAM/S3/EC2/STS/CloudTrail), bcryptjs + jsonwebtoken auth, Drizzle ORM + PostgreSQL
- Shared: `lib/api-spec/openapi.yaml`, `lib/api-client-react` (Orval React Query codegen), `lib/api-zod` (Orval Zod codegen), `lib/db` (Drizzle schema + push)

## DB Tables
- `usersTable` — id, name, email, passwordHash, timestamps
- `awsAccountsTable` — id, userId FK, name, accessKeyId, secretAccessKey, region, lastScanAt, lastScore
- `scansTable` — id, userId FK, accountId FK, status, progress, currentModule, score fields per service, severity counts, modulesJson
- `findingsTable` — id, scanId FK, service enum, checkId, title, description, severity, affectedResource, recommendation, metadataJson

## Auth
- JWT via `SESSION_SECRET` env var, stored in localStorage as `sentinel_token`
- `requireAuth` middleware in `artifacts/api-server/src/lib/auth.ts`
- `AuthProvider` in `artifacts/sentinel/src/lib/auth.tsx`

## Scanner modules
Located in `artifacts/api-server/src/scanners/`:
- `iam.ts` — MFA, key age, inactive users, admin policies, password policy
- `s3.ts` — public access block, public policy, ACL, encryption, versioning  
- `ec2.ts` — public IPs, missing IAM role, unencrypted EBS, stopped instances, security group open ports
- `cloudtrail.ts` — trail enabled, multi-region, KMS encryption, log validation
- `scan-engine.ts` — orchestrates all scanners, writes findings, updates scan progress/scores

**Why:** Adapted from Python/FastAPI/Boto3 spec to match existing Node.js monorepo; AWS SDK v3 has feature parity with Boto3.
