import {
  CloudTrailClient,
  DescribeTrailsCommand,
  GetTrailStatusCommand,
} from "@aws-sdk/client-cloudtrail";
import { type ScanFinding } from "./iam";

export async function scanCloudTrail(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const client = new CloudTrailClient({
    credentials: { accessKeyId, secretAccessKey },
    region,
  });

  try {
    const trailsResp = await client.send(
      new DescribeTrailsCommand({ includeShadowTrails: true }),
    );
    const trails = trailsResp.trailList ?? [];

    if (trails.length === 0) {
      findings.push({
        service: "cloudtrail",
        checkId: "cloudtrail-not-enabled",
        title: "CloudTrail is not enabled",
        description: "No CloudTrail trails found in this account. AWS API activity is not being logged.",
        severity: "critical",
        affectedResource: `arn:aws:cloudtrail:${region}::`,
        recommendation:
          "Enable AWS CloudTrail to log all API activity. Create a trail that applies to all regions and stores logs in an S3 bucket.",
      });
      return findings;
    }

    let hasMultiRegionTrail = false;
    let hasEnabledTrail = false;

    for (const trail of trails) {
      const trailArn = trail.TrailARN ?? `arn:aws:cloudtrail:${region}::trail/${trail.Name}`;

      if (trail.IsMultiRegionTrail) {
        hasMultiRegionTrail = true;
      }

      // Check if trail is logging
      try {
        const statusResp = await client.send(
          new GetTrailStatusCommand({ Name: trailArn }),
        );

        if (!statusResp.IsLogging) {
          findings.push({
            service: "cloudtrail",
            checkId: "cloudtrail-not-logging",
            title: `CloudTrail trail "${trail.Name}" is not actively logging`,
            description: `Trail "${trail.Name}" exists but is not currently recording AWS API activity.`,
            severity: "critical",
            affectedResource: trailArn,
            recommendation: "Start logging on the CloudTrail trail immediately.",
          });
        } else {
          hasEnabledTrail = true;
        }
      } catch {
        // Skip
      }

      // Check encryption
      if (!trail.KmsKeyId) {
        findings.push({
          service: "cloudtrail",
          checkId: "cloudtrail-no-encryption",
          title: `CloudTrail trail "${trail.Name}" is not encrypted with KMS`,
          description: `Trail "${trail.Name}" stores log files without KMS encryption.`,
          severity: "medium",
          affectedResource: trailArn,
          recommendation:
            "Enable KMS encryption for CloudTrail log files to protect sensitive API activity data.",
        });
      }

      // Check log file validation
      if (!trail.LogFileValidationEnabled) {
        findings.push({
          service: "cloudtrail",
          checkId: "cloudtrail-no-log-validation",
          title: `CloudTrail trail "${trail.Name}" does not have log file validation enabled`,
          description: `Log file integrity validation is disabled for trail "${trail.Name}". Logs could be tampered with undetected.`,
          severity: "medium",
          affectedResource: trailArn,
          recommendation:
            "Enable CloudTrail log file validation to detect unauthorized modification of log files.",
        });
      }
    }

    if (!hasMultiRegionTrail) {
      findings.push({
        service: "cloudtrail",
        checkId: "cloudtrail-not-multi-region",
        title: "No multi-region CloudTrail trail configured",
        description: "No CloudTrail trail is configured to capture events across all AWS regions.",
        severity: "high",
        affectedResource: `arn:aws:cloudtrail:${region}::`,
        recommendation:
          "Create or update a CloudTrail trail to capture events from all AWS regions. API activity in other regions will not be logged.",
      });
    }

    if (!hasEnabledTrail) {
      findings.push({
        service: "cloudtrail",
        checkId: "cloudtrail-all-disabled",
        title: "All CloudTrail trails are disabled",
        description: "CloudTrail trails exist but none are actively logging events.",
        severity: "critical",
        affectedResource: `arn:aws:cloudtrail:${region}::`,
        recommendation: "Enable at least one CloudTrail trail to audit AWS API activity.",
      });
    }
  } catch (err) {
    findings.push({
      service: "cloudtrail",
      checkId: "cloudtrail-scan-error",
      title: "CloudTrail scan could not complete",
      description: `Failed to complete CloudTrail scan: ${err instanceof Error ? err.message : String(err)}`,
      severity: "informational",
      affectedResource: `arn:aws:cloudtrail:${region}::`,
      recommendation: "Ensure the IAM user has cloudtrail:Describe* and cloudtrail:Get* permissions.",
    });
  }

  return findings;
}
