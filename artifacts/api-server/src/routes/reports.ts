import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, scansTable, awsAccountsTable, findingsTable } from "@workspace/db";
import {
  DownloadCsvReportQueryParams,
  GetReportSummaryQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function formatScanRow(scan: typeof scansTable.$inferSelect, accountName: string) {
  return {
    id: scan.id,
    accountId: scan.accountId,
    accountName,
    status: scan.status,
    progress: scan.progress,
    currentModule: scan.currentModule ?? null,
    overallScore: scan.overallScore ?? null,
    iamScore: scan.iamScore ?? null,
    s3Score: scan.s3Score ?? null,
    ec2Score: scan.ec2Score ?? null,
    networkingScore: scan.networkingScore ?? null,
    cloudtrailScore: scan.cloudtrailScore ?? null,
    criticalCount: scan.criticalCount,
    highCount: scan.highCount,
    mediumCount: scan.mediumCount,
    lowCount: scan.lowCount,
    startedAt: scan.startedAt.toISOString(),
    completedAt: scan.completedAt?.toISOString() ?? null,
    errorMessage: scan.errorMessage ?? null,
  };
}

function formatFinding(f: typeof findingsTable.$inferSelect) {
  return {
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
  };
}

async function resolveScanAndFindings(
  userId: number,
  scanId?: number,
  accountId?: number,
) {
  // Determine which scan to report on
  let scanRow: { scan: typeof scansTable.$inferSelect; accountName: string | null } | null = null;

  if (scanId) {
    const [row] = await db
      .select({ scan: scansTable, accountName: awsAccountsTable.name })
      .from(scansTable)
      .leftJoin(awsAccountsTable, eq(scansTable.accountId, awsAccountsTable.id))
      .where(and(eq(scansTable.id, scanId), eq(scansTable.userId, userId)));
    scanRow = row ?? null;
  } else {
    // Use the latest completed scan (optionally filtered by account)
    const conds = [eq(scansTable.userId, userId), eq(scansTable.status, "completed")];
    if (accountId) conds.push(eq(scansTable.accountId, accountId));

    const [row] = await db
      .select({ scan: scansTable, accountName: awsAccountsTable.name })
      .from(scansTable)
      .leftJoin(awsAccountsTable, eq(scansTable.accountId, awsAccountsTable.id))
      .where(and(...conds))
      .orderBy(scansTable.startedAt)
      .limit(1);
    scanRow = row ?? null;
  }

  if (!scanRow) return null;

  const findings = await db
    .select()
    .from(findingsTable)
    .where(eq(findingsTable.scanId, scanRow.scan.id));

  return { scan: scanRow.scan, accountName: scanRow.accountName ?? "Unknown", findings };
}

// GET /reports/summary
router.get("/reports/summary", requireAuth, async (req, res): Promise<void> => {
  const params = GetReportSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const data = await resolveScanAndFindings(
    req.user!.userId,
    params.data.scanId,
    params.data.accountId,
  );

  if (!data) {
    res.status(404).json({ error: "not_found", message: "No scan found" });
    return;
  }

  const { scan, accountName, findings } = data;

  res.json({
    scan: formatScanRow(scan, accountName),
    criticalFindings: findings.filter((f) => f.severity === "critical").map(formatFinding),
    highFindings: findings.filter((f) => f.severity === "high").map(formatFinding),
    mediumFindings: findings.filter((f) => f.severity === "medium").map(formatFinding),
    lowFindings: findings.filter((f) => f.severity === "low").map(formatFinding),
  });
});

// GET /reports/csv
router.get("/reports/csv", requireAuth, async (req, res): Promise<void> => {
  const params = DownloadCsvReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const data = await resolveScanAndFindings(
    req.user!.userId,
    params.data.scanId,
    params.data.accountId,
  );

  if (!data) {
    res.status(404).json({ error: "not_found", message: "No scan found" });
    return;
  }

  const { scan, accountName, findings } = data;

  // Build CSV
  const header =
    "Severity,Service,Title,Affected Resource,Description,Recommendation,Check ID\n";
  const rows = findings.map((f) => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      escape(f.severity),
      escape(f.service),
      escape(f.title),
      escape(f.affectedResource),
      escape(f.description),
      escape(f.recommendation),
      escape(f.checkId),
    ].join(",");
  });

  const scanDate = scan.completedAt?.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0];
  const filename = `sentinel-aws-report-${accountName.replace(/\s+/g, "-")}-${scanDate}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(header + rows.join("\n"));
});

export default router;
