import {
  IAMClient,
  ListUsersCommand,
  ListMFADevicesCommand,
  ListAccessKeysCommand,
  GetAccountPasswordPolicyCommand,
  ListAttachedUserPoliciesCommand,
  ListUserPoliciesCommand,
  GetUserPolicyCommand,
  ListGroupsForUserCommand,
  ListAttachedGroupPoliciesCommand,
} from "@aws-sdk/client-iam";

export interface ScanFinding {
  service: "iam" | "s3" | "ec2" | "security_groups" | "cloudtrail";
  checkId: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  affectedResource: string;
  recommendation: string;
  metadataJson?: string;
}

export async function scanIam(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const client = new IAMClient({
    credentials: { accessKeyId, secretAccessKey },
    region,
  });

  try {
    // List all IAM users
    const usersResp = await client.send(new ListUsersCommand({ MaxItems: 100 }));
    const users = usersResp.Users ?? [];

    for (const user of users) {
      const username = user.UserName ?? "unknown";
      const arn = user.Arn ?? username;

      // Check MFA
      try {
        const mfaResp = await client.send(
          new ListMFADevicesCommand({ UserName: username }),
        );
        if ((mfaResp.MFADevices ?? []).length === 0) {
          findings.push({
            service: "iam",
            checkId: "iam-user-no-mfa",
            title: "IAM user does not have MFA enabled",
            description: `User "${username}" does not have multi-factor authentication (MFA) enabled.`,
            severity: "high",
            affectedResource: arn,
            recommendation:
              "Enable MFA for all IAM users, especially those with console access. Use virtual or hardware MFA devices.",
          });
        }
      } catch {
        // Permission denied — skip
      }

      // Check access key age
      try {
        const keysResp = await client.send(
          new ListAccessKeysCommand({ UserName: username }),
        );
        for (const key of keysResp.AccessKeyMetadata ?? []) {
          if (key.CreateDate) {
            const ageDays =
              (Date.now() - key.CreateDate.getTime()) / (1000 * 60 * 60 * 24);
            if (ageDays > 90) {
              findings.push({
                service: "iam",
                checkId: "iam-access-key-old",
                title: "IAM access key older than 90 days",
                description: `Access key "${key.AccessKeyId}" for user "${username}" was created ${Math.floor(ageDays)} days ago.`,
                severity: ageDays > 180 ? "high" : "medium",
                affectedResource: arn,
                recommendation:
                  "Rotate IAM access keys every 90 days. Revoke keys that are no longer needed.",
                metadataJson: JSON.stringify({
                  keyId: key.AccessKeyId,
                  ageDays: Math.floor(ageDays),
                }),
              });
            }
          }
        }
      } catch {
        // Permission denied — skip
      }

      // Check unused users (no activity in 90 days)
      if (user.PasswordLastUsed) {
        const ageDays =
          (Date.now() - user.PasswordLastUsed.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > 90) {
          findings.push({
            service: "iam",
            checkId: "iam-user-inactive",
            title: "IAM user has not signed in for over 90 days",
            description: `User "${username}" last signed in ${Math.floor(ageDays)} days ago.`,
            severity: "medium",
            affectedResource: arn,
            recommendation:
              "Review and disable or delete IAM users that have been inactive for 90+ days.",
            metadataJson: JSON.stringify({ lastUsed: user.PasswordLastUsed }),
          });
        }
      }

      // Check admin permissions
      try {
        const attachedPolicies = await client.send(
          new ListAttachedUserPoliciesCommand({ UserName: username }),
        );
        const hasAdmin = (attachedPolicies.AttachedPolicies ?? []).some(
          (p) =>
            p.PolicyArn === "arn:aws:iam::aws:policy/AdministratorAccess",
        );
        if (hasAdmin) {
          findings.push({
            service: "iam",
            checkId: "iam-user-admin",
            title: "IAM user has AdministratorAccess policy attached",
            description: `User "${username}" has the AWS AdministratorAccess policy which grants full access to all AWS services.`,
            severity: "critical",
            affectedResource: arn,
            recommendation:
              "Follow the principle of least privilege. Replace AdministratorAccess with specific policies granting only required permissions.",
          });
        }
      } catch {
        // Permission denied — skip
      }
    }

    // Check password policy
    try {
      const ppResp = await client.send(new GetAccountPasswordPolicyCommand({}));
      const pp = ppResp.PasswordPolicy;
      if (!pp) {
        findings.push({
          service: "iam",
          checkId: "iam-weak-password-policy",
          title: "No IAM account password policy is set",
          description: "The AWS account does not have a custom IAM password policy configured.",
          severity: "medium",
          affectedResource: "iam://account/password-policy",
          recommendation:
            "Configure a strong password policy: minimum 14 characters, require uppercase, lowercase, numbers, and symbols. Enable password expiration.",
        });
      } else {
        if ((pp.MinimumPasswordLength ?? 0) < 14) {
          findings.push({
            service: "iam",
            checkId: "iam-weak-password-min-length",
            title: "IAM password policy minimum length is less than 14",
            description: `Password policy minimum length is ${pp.MinimumPasswordLength ?? 0} characters. Best practice is at least 14.`,
            severity: "medium",
            affectedResource: "iam://account/password-policy",
            recommendation: "Set the IAM password policy minimum length to at least 14 characters.",
          });
        }
        if (!pp.RequireLowercaseCharacters || !pp.RequireUppercaseCharacters ||
            !pp.RequireNumbers || !pp.RequireSymbols) {
          findings.push({
            service: "iam",
            checkId: "iam-weak-password-complexity",
            title: "IAM password policy does not require sufficient complexity",
            description: "Password policy does not require all character types (uppercase, lowercase, numbers, symbols).",
            severity: "low",
            affectedResource: "iam://account/password-policy",
            recommendation: "Require uppercase, lowercase, numbers, and symbols in the password policy.",
          });
        }
      }
    } catch (err: unknown) {
      // NoSuchEntityException means no policy set
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("NoSuchEntity")) {
        findings.push({
          service: "iam",
          checkId: "iam-no-password-policy",
          title: "No IAM account password policy configured",
          description: "AWS account does not have a password policy. Console users can use any password.",
          severity: "medium",
          affectedResource: "iam://account/password-policy",
          recommendation: "Configure a strong IAM password policy requiring complexity, expiration, and minimum length.",
        });
      }
    }
  } catch (err) {
    // Top-level error — likely permissions issue
    findings.push({
      service: "iam",
      checkId: "iam-scan-error",
      title: "IAM scan could not complete",
      description: `Failed to complete IAM scan: ${err instanceof Error ? err.message : String(err)}`,
      severity: "informational",
      affectedResource: "iam://",
      recommendation: "Ensure the IAM user has ReadOnlyAccess or IAMReadOnlyAccess permissions.",
    });
  }

  return findings;
}
