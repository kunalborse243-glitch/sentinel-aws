import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, scansTable, awsAccountsTable, findingsTable } from "@workspace/db";
import {
  StartScanBody,
  GetScanParams,
  ListScansQueryParams,
  CompareScanParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { runScan } from "../lib/scan-engine";

const router: IRouter = Router();

function formatScan(scan: typeof scansTable.$inferSelect, accountName: string) {
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

// GET /scans
router.get("/scans", requireAuth, async (req, res): Promise<void> => {
  const params = ListScansQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const page = params.data.page ?? 1;
  const limit = params.data.limit ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(scansTable.userId, req.user!.userId)];
  if (params.data.accountId) {
    conditions.push(eq(scansTable.accountId, params.data.accountId));
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scansTable)
    .where(and(...conditions));

  const scans = await db
    .select({
      scan: scansTable,
      accountName: awsAccountsTable.name,
    })
    .from(scansTable)
    .leftJoin(awsAccountsTable, eq(scansTable.accountId, awsAccountsTable.id))
    .where(and(...conditions))
    .orderBy(desc(scansTable.startedAt))
    .limit(limit)
    .offset(offset);

  res.json({
    data: scans.map((r) => formatScan(r.scan, r.accountName ?? "Unknown")),
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  });
});

// POST /scans
router.post("/scans", requireAuth, async (req, res): Promise<void> => {
  const parsed = StartScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { accountId, modules } = parsed.data;

  // Verify account belongs to user
  const [account] = await db
    .select()
    .from(awsAccountsTable)
    .where(
      and(
        eq(awsAccountsTable.id, accountId),
        eq(awsAccountsTable.userId, req.user!.userId),
      ),
    );

  if (!account) {
    res.status(404).json({ error: "not_found", message: "AWS account not found" });
    return;
  }

  const validModules = ["iam", "s3", "ec2", "security_groups", "cloudtrail"] as const;
  type Module = (typeof validModules)[number];
  const enabledModules: Module[] = (modules ?? validModules as unknown as string[]).filter((m): m is Module =>
    validModules.includes(m as Module),
  );

  const [scan] = await db
    .insert(scansTable)
    .values({
      userId: req.user!.userId,
      accountId,
      status: "pending",
      modulesJson: JSON.stringify(enabledModules),
    })
    .returning();

  // Run scan asynchronously (fire-and-forget)
  setImmediate(() => {
    runScan(scan.id, accountId, enabledModules).catch((err) => {
      // Error handled inside runScan
      void err;
    });
  });

  res.status(202).json(formatScan(scan, account.name));
});

// GET /scans/:id
router.get("/scans/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const [row] = await db
    .select({ scan: scansTable, accountName: awsAccountsTable.name })
    .from(scansTable)
    .leftJoin(awsAccountsTable, eq(scansTable.accountId, awsAccountsTable.id))
    .where(
      and(
        eq(scansTable.id, params.data.id),
        eq(scansTable.userId, req.user!.userId),
      ),
    );

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Scan not found" });
    return;
  }

  const findings = await db
    .select()
    .from(findingsTable)
    .where(eq(findingsTable.scanId, params.data.id));

  res.json({
    ...formatScan(row.scan, row.accountName ?? "Unknown"),
    findings: findings.map((f) => ({
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
    })),
  });
});

// GET /scans/:id/compare/:compareWithId
router.get("/scans/:id/compare/:compareWithId", requireAuth, async (req, res): Promise<void> => {
  const params = CompareScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const userId = req.user!.userId;

  const fetchScan = async (scanId: number) => {
    const [row] = await db
      .select({ scan: scansTable, accountName: awsAccountsTable.name })
      .from(scansTable)
      .leftJoin(awsAccountsTable, eq(scansTable.accountId, awsAccountsTable.id))
      .where(and(eq(scansTable.id, scanId), eq(scansTable.userId, userId)));
    return row;
  };

  const [current, previous] = await Promise.all([
    fetchScan(params.data.id),
    fetchScan(params.data.compareWithId),
  ]);

  if (!current || !previous) {
    res.status(404).json({ error: "not_found", message: "One or both scans not found" });
    return;
  }

  const [currentFindings, previousFindings] = await Promise.all([
    db.select().from(findingsTable).where(eq(findingsTable.scanId, params.data.id)),
    db.select().from(findingsTable).where(eq(findingsTable.scanId, params.data.compareWithId)),
  ]);

  const previousCheckIds = new Set(previousFindings.map((f) => f.checkId + ":" + f.affectedResource));
  const currentCheckIds = new Set(currentFindings.map((f) => f.checkId + ":" + f.affectedResource));

  const newFindings = currentFindings.filter(
    (f) => !previousCheckIds.has(f.checkId + ":" + f.affectedResource),
  );
  const resolvedFindings = previousFindings.filter(
    (f) => !currentCheckIds.has(f.checkId + ":" + f.affectedResource),
  );
  const persistingFindings = currentFindings.filter((f) =>
    previousCheckIds.has(f.checkId + ":" + f.affectedResource),
  );

  const formatFinding = (f: typeof findingsTable.$inferSelect) => ({
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
  });

  const scoreDelta =
    (current.scan.overallScore ?? 0) - (previous.scan.overallScore ?? 0);

  res.json({
    current: formatScan(current.scan, current.accountName ?? "Unknown"),
    previous: formatScan(previous.scan, previous.accountName ?? "Unknown"),
    scoreDelta,
    newFindings: newFindings.map(formatFinding),
    resolvedFindings: resolvedFindings.map(formatFinding),
    persistingFindings: persistingFindings.map(formatFinding),
  });
});

export default router;
