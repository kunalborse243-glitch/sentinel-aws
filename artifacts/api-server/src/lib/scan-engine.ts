import { eq } from "drizzle-orm";
import { db, scansTable, findingsTable, awsAccountsTable } from "@workspace/db";
import { scanIam, scanS3, scanEc2, scanCloudTrail, type ScanFinding } from "../scanners";
import { logger } from "./logger";

type Module = "iam" | "s3" | "ec2" | "security_groups" | "cloudtrail";

const MODULE_ORDER: Module[] = ["iam", "s3", "ec2", "security_groups", "cloudtrail"];

/** Calculates a 0-100 score based on findings for a service */
function calculateScore(findings: ScanFinding[], service?: string): number {
  const relevant = service
    ? findings.filter((f) => f.service === service || (service === "security_groups" && f.service === "security_groups"))
    : findings;

  if (relevant.length === 0) return 100;

  const weights = { critical: 25, high: 15, medium: 8, low: 3, informational: 0 };
  const penalty = relevant.reduce((sum, f) => sum + (weights[f.severity] ?? 0), 0);
  return Math.max(0, Math.round(100 - penalty));
}

export async function runScan(scanId: number, accountId: number, modules: Module[]): Promise<void> {
  const [account] = await db
    .select()
    .from(awsAccountsTable)
    .where(eq(awsAccountsTable.id, accountId));

  if (!account) {
    await db
      .update(scansTable)
      .set({ status: "failed", errorMessage: "Account not found", completedAt: new Date() })
      .where(eq(scansTable.id, scanId));
    return;
  }

  const { accessKeyId, secretAccessKey, region } = account;
  const enabledModules = modules.length > 0 ? modules : MODULE_ORDER;
  const allFindings: ScanFinding[] = [];

  // Update status to running
  await db
    .update(scansTable)
    .set({ status: "running", progress: 0 })
    .where(eq(scansTable.id, scanId));

  for (let i = 0; i < enabledModules.length; i++) {
    const module = enabledModules[i];
    const progress = Math.round((i / enabledModules.length) * 90);

    await db
      .update(scansTable)
      .set({ currentModule: module, progress })
      .where(eq(scansTable.id, scanId));

    try {
      let moduleFindings: ScanFinding[] = [];
      switch (module) {
        case "iam":
          moduleFindings = await scanIam(accessKeyId, secretAccessKey, region);
          break;
        case "s3":
          moduleFindings = await scanS3(accessKeyId, secretAccessKey, region);
          break;
        case "ec2":
        case "security_groups":
          // EC2 and security groups are scanned together
          if (module === "ec2") {
            moduleFindings = await scanEc2(accessKeyId, secretAccessKey, region);
          }
          break;
        case "cloudtrail":
          moduleFindings = await scanCloudTrail(accessKeyId, secretAccessKey, region);
          break;
      }
      allFindings.push(...moduleFindings);
    } catch (err) {
      logger.error({ err, module, scanId }, "Module scan error");
    }
  }

  // Insert all findings
  if (allFindings.length > 0) {
    await db.insert(findingsTable).values(
      allFindings.map((f) => ({
        scanId,
        service: f.service,
        checkId: f.checkId,
        title: f.title,
        description: f.description,
        severity: f.severity,
        affectedResource: f.affectedResource,
        recommendation: f.recommendation,
        metadataJson: f.metadataJson ?? null,
      })),
    );
  }

  // Calculate scores
  const iamFindings = allFindings.filter((f) => f.service === "iam");
  const s3Findings = allFindings.filter((f) => f.service === "s3");
  const ec2Findings = allFindings.filter((f) => f.service === "ec2");
  const sgFindings = allFindings.filter((f) => f.service === "security_groups");
  const ctFindings = allFindings.filter((f) => f.service === "cloudtrail");

  const iamScore = enabledModules.includes("iam") ? calculateScore(iamFindings) : null;
  const s3Score = enabledModules.includes("s3") ? calculateScore(s3Findings) : null;
  const ec2Score = enabledModules.includes("ec2") ? calculateScore(ec2Findings) : null;
  const networkingScore = enabledModules.includes("security_groups") ? calculateScore(sgFindings) : null;
  const cloudtrailScore = enabledModules.includes("cloudtrail") ? calculateScore(ctFindings) : null;

  const scores = [iamScore, s3Score, ec2Score, networkingScore, cloudtrailScore].filter(
    (s): s is number => s !== null,
  );
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const criticalCount = allFindings.filter((f) => f.severity === "critical").length;
  const highCount = allFindings.filter((f) => f.severity === "high").length;
  const mediumCount = allFindings.filter((f) => f.severity === "medium").length;
  const lowCount = allFindings.filter((f) => f.severity === "low").length;

  // Update scan with results
  await db
    .update(scansTable)
    .set({
      status: "completed",
      progress: 100,
      currentModule: null,
      overallScore,
      iamScore,
      s3Score,
      ec2Score,
      networkingScore,
      cloudtrailScore,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      completedAt: new Date(),
    })
    .where(eq(scansTable.id, scanId));

  // Update account last scan info
  await db
    .update(awsAccountsTable)
    .set({ lastScanAt: new Date(), lastScore: overallScore })
    .where(eq(awsAccountsTable.id, accountId));

  logger.info(
    { scanId, overallScore, findings: allFindings.length },
    "Scan completed",
  );
}
