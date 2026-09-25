# sentinel-aws

Sentinel AWS is a cloud security auditing tool for connecting AWS accounts, scanning cloud resources, and reviewing security findings.

## Features

- User registration and authentication
- Connect and manage AWS accounts
- Scan AWS resources for security issues
- Analyze IAM, EC2, S3, and CloudTrail configurations
- View findings by severity
- Review scan history
- Generate security reports
- Dashboard with account and security metrics

## Tech Stack

- React 19
- Vite
- TypeScript
- Express 5
- PostgreSQL
- Drizzle ORM
- AWS SDK
- Zod
- TanStack Query
- Tailwind CSS
- pnpm workspaces

## Project Structure

```text
artifacts/
  api-server/       Express API and AWS scanning engine
  sentinel/         React frontend
  mockup-sandbox/   UI mockup sandbox

lib/
  api-client-react/ Generated React API client
  api-spec/         OpenAPI specification
  api-zod/          Generated Zod schemas
  db/               Database schema and Drizzle configuration
