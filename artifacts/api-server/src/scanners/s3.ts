import {
  S3Client,
  ListBucketsCommand,
  GetBucketAclCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetPublicAccessBlockCommand,
  GetBucketPolicyStatusCommand,
} from "@aws-sdk/client-s3";
import { type ScanFinding } from "./iam";

export async function scanS3(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    region,
  });

  try {
    const bucketsResp = await client.send(new ListBucketsCommand({}));
    const buckets = bucketsResp.Buckets ?? [];

    for (const bucket of buckets) {
      const name = bucket.Name ?? "unknown";
      const arn = `arn:aws:s3:::${name}`;

      // Check Block Public Access
      try {
        const bpaResp = await client.send(
          new GetPublicAccessBlockCommand({ Bucket: name }),
        );
        const config = bpaResp.PublicAccessBlockConfiguration;
        const isFullyBlocked =
          config?.BlockPublicAcls &&
          config?.IgnorePublicAcls &&
          config?.BlockPublicPolicy &&
          config?.RestrictPublicBuckets;

        if (!isFullyBlocked) {
          findings.push({
            service: "s3",
            checkId: "s3-public-access-not-blocked",
            title: "S3 bucket does not have all Block Public Access settings enabled",
            description: `Bucket "${name}" does not have all four Block Public Access settings enabled.`,
            severity: "high",
            affectedResource: arn,
            recommendation:
              "Enable all four S3 Block Public Access settings: BlockPublicAcls, IgnorePublicAcls, BlockPublicPolicy, and RestrictPublicBuckets.",
            metadataJson: JSON.stringify(config),
          });
        }
      } catch {
        // Skip if permissions not available
      }

      // Check public policy
      try {
        const policyStatus = await client.send(
          new GetBucketPolicyStatusCommand({ Bucket: name }),
        );
        if (policyStatus.PolicyStatus?.IsPublic) {
          findings.push({
            service: "s3",
            checkId: "s3-public-policy",
            title: "S3 bucket has a public bucket policy",
            description: `Bucket "${name}" has a bucket policy that grants public access.`,
            severity: "critical",
            affectedResource: arn,
            recommendation:
              "Review and restrict the bucket policy. Use conditions to limit access to specific principals or VPC endpoints.",
          });
        }
      } catch {
        // NoSuchBucketPolicy or similar — skip
      }

      // Check ACL
      try {
        const aclResp = await client.send(
          new GetBucketAclCommand({ Bucket: name }),
        );
        const isPublic = (aclResp.Grants ?? []).some(
          (grant) =>
            grant.Grantee?.URI ===
              "http://acs.amazonaws.com/groups/global/AllUsers" ||
            grant.Grantee?.URI ===
              "http://acs.amazonaws.com/groups/global/AuthenticatedUsers",
        );
        if (isPublic) {
          findings.push({
            service: "s3",
            checkId: "s3-public-acl",
            title: "S3 bucket ACL grants public access",
            description: `Bucket "${name}" has an ACL that grants access to all users or authenticated AWS users.`,
            severity: "critical",
            affectedResource: arn,
            recommendation:
              "Remove public ACL grants. Use bucket policies with specific principals instead of ACLs.",
          });
        }
      } catch {
        // Skip
      }

      // Check encryption
      try {
        await client.send(
          new GetBucketEncryptionCommand({ Bucket: name }),
        );
        // If no error, encryption is enabled
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes("ServerSideEncryptionConfigurationNotFoundError") ||
          message.includes("NoSuchEncryptionConfiguration")
        ) {
          findings.push({
            service: "s3",
            checkId: "s3-no-encryption",
            title: "S3 bucket does not have server-side encryption enabled",
            description: `Bucket "${name}" does not have default server-side encryption configured.`,
            severity: "medium",
            affectedResource: arn,
            recommendation:
              "Enable default server-side encryption using SSE-S3 (AES-256) or SSE-KMS for sensitive data.",
          });
        }
      }

      // Check versioning
      try {
        const versioningResp = await client.send(
          new GetBucketVersioningCommand({ Bucket: name }),
        );
        if (versioningResp.Status !== "Enabled") {
          findings.push({
            service: "s3",
            checkId: "s3-no-versioning",
            title: "S3 bucket does not have versioning enabled",
            description: `Bucket "${name}" does not have versioning enabled. Data cannot be recovered after accidental deletion.`,
            severity: "low",
            affectedResource: arn,
            recommendation:
              "Enable S3 versioning to protect against accidental deletions and overwrites.",
          });
        }
      } catch {
        // Skip
      }
    }
  } catch (err) {
    findings.push({
      service: "s3",
      checkId: "s3-scan-error",
      title: "S3 scan could not complete",
      description: `Failed to complete S3 scan: ${err instanceof Error ? err.message : String(err)}`,
      severity: "informational",
      affectedResource: "s3://",
      recommendation: "Ensure the IAM user has s3:List* and s3:GetBucket* permissions.",
    });
  }

  return findings;
}
