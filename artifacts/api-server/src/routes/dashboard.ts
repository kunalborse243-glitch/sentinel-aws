import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, scansTable, awsAccountsTable, findingsTable } from "@workspace/db";
import { GetDashboardSummaryQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /dashboard/summary
router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const params = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const userId = req.user!.userId;

  const scanConditions = [eq(scansTable.userId, userId), eq(scansTable.status, "completed")];
  if (params.data.accountId) {
    scanConditions.push(eq(scansTable.accountId, params.data.accountId));
  }

  // Get counts
  const [{ totalAccounts }] = await db
    .select({ totalAccounts: sql<number>`count(*)::int` })
    .from(awsAccountsTable)
    .where(eq(awsAccountsTable.userId, userId));

  const [{ totalScans }] = await db
    .select({ totalScans: sql<number>`count(*)::int` })
    .from(scansTable)
    .where(eq(scansTable.userId, userId));

  // Most recent completed scan
  const [latestScan] = await db
    .select({ scan: scansTable, accountName: awsAccountsTable.name })
    .from(scansTable)
    .leftJoin(awsAccountsTable, eq(scansTable.accountId, awsAccountsTable.id))
    .where(and(...scanConditions))
    .orderBy(desc(scansTable.startedAt))
    .limit(1);

  // Severity counts from the latest scan's findings
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let overallScore: number | null = null;
  let lastScanAt: string | null = null;

  if (latestScan) {
    criticalCount = latestScan.scan.criticalCount;
    highCount = latestScan.scan.highCount;
    mediumCount = latestScan.scan.mediumCount;
    lowCount = latestScan.scan.lowCount;
    overallScore = latestScan.scan.overallScore ?? null;
    lastScanAt = latestScan.scan.completedAt?.toISOString() ?? null;
  }

  // Service scores from latest scan
  const serviceScores: Array<{
    service: string;
    score: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  }> = [];

  if (latestScan) {
    const scan = latestScan.scan;
    const services = [
      { service: "IAM", score: scan.iamScore },
      { service: "S3", score: scan.s3Score },
      { service: "EC2", score: scan.ec2Score },
      { service: "Networking", score: scan.networkingScore },
      { service: "CloudTrail", score: scan.cloudtrailScore },
    ];

    const serviceMap: Record<string, string> = {
      IAM: "iam",
      S3: "s3",
      EC2: "ec2",
      Networking: "security_groups",
      CloudTrail: "cloudtrail",
    };

    // Get per-service finding counts
    const findingCounts = await db
      .select({
        service: findingsTable.service,
        severity: findingsTable.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(findingsTable)
      .where(eq(findingsTable.scanId, scan.id))
      .groupBy(findingsTable.service, findingsTable.severity);

    const countMap: Record<string, Record<string, number>> = {};
    for (const row of findingCounts) {
      if (!countMap[row.service]) countMap[row.service] = {};
      countMap[row.service][row.severity] = row.count;
    }

    for (const { service, score } of services) {
      if (score !== null && score !== undefined) {
        const svcKey = serviceMap[service] ?? service.toLowerCase();
        const counts = countMap[svcKey] ?? {};
        serviceScores.push({
          service,
          score,
          criticalCount: counts["critical"] ?? 0,
          highCount: counts["high"] ?? 0,
          mediumCount: counts["medium"] ?? 0,
          lowCount: counts["low"] ?? 0,
        });
      }
    }
  }

  // Recent scans (last 5)
  const recentScansData = await db
    .select({ scan: scansTable, accountName: awsAccountsTable.name })
    .from(scansTable)
    .leftJoin(awsAccountsTable, eq(scansTable.accountId, awsAccountsTable.id))
    .where(eq(scansTable.userId, userId))
    .orderBy(desc(scansTable.startedAt))
    .limit(5);

  const recentScans = recentScansData.map((r) => ({
    id: r.scan.id,
    accountId: r.scan.accountId,
    accountName: r.accountName ?? "Unknown",
    status: r.scan.status,
    progress: r.scan.progress,
    currentModule: r.scan.currentModule ?? null,
    overallScore: r.scan.overallScore ?? null,
    iamScore: r.scan.iamScore ?? null,
    s3Score: r.scan.s3Score ?? null,
    ec2Score: r.scan.ec2Score ?? null,
    networkingScore: r.scan.networkingScore ?? null,
    cloudtrailScore: r.scan.cloudtrailScore ?? null,
    criticalCount: r.scan.criticalCount,
    highCount: r.scan.highCount,
    mediumCount: r.scan.mediumCount,
    lowCount: r.scan.lowCount,
    startedAt: r.scan.startedAt.toISOString(),
    completedAt: r.scan.completedAt?.toISOString() ?? null,
    errorMessage: r.scan.errorMessage ?? null,
  }));

  // Recent findings (last 10 from latest scan)
  let recentFindings: Array<unknown> = [];
  if (latestScan) {
    const recentFindingsData = await db
      .select()
      .from(findingsTable)
      .where(eq(findingsTable.scanId, latestScan.scan.id))
      .orderBy(findingsTable.id)
      .limit(10);

    recentFindings = recentFindingsData.map((f) => ({
      id: f.id,
      scanId: f.scanId,
      service: f.service,
      checkId: f.checkId,
      title: f.title,
      description: f.description,
      severity: f.severity,
      affectedResource: f.affectedResource,
      recommendation: f.recommendation,
      metadataJson: f.metadataJson ?? null,
    }));
  }

  // Score history (last 10 completed scans)
  const historyData = await db
    .select()
    .from(scansTable)
    .where(and(...scanConditions))
    .orderBy(desc(scansTable.startedAt))
    .limit(10);

  const scoreHistory = historyData
    .filter((s) => s.overallScore !== null)
    .reverse()
    .map((s) => ({
      date: s.completedAt?.toISOString().split("T")[0] ?? s.startedAt.toISOString().split("T")[0],
      score: s.overallScore!,
    }));

  res.json({
    overallScore,
    lastScanAt,
    totalAccounts,
    totalScans,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    serviceScores,
    recentScans,
    recentFindings,
    scoreHistory,
  });
});

export default router;
