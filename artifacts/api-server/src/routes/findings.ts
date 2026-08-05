import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, findingsTable, scansTable } from "@workspace/db";
import { ListFindingsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /findings
router.get("/findings", requireAuth, async (req, res): Promise<void> => {
  const params = ListFindingsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const page = params.data.page ?? 1;
  const limit = params.data.limit ?? 20;
  const offset = (page - 1) * limit;

  // Build conditions — always scope to user's scans
  const userScanIds = db
    .select({ id: scansTable.id })
    .from(scansTable)
    .where(eq(scansTable.userId, req.user!.userId));

  const conditions = [sql`${findingsTable.scanId} IN (${userScanIds})`];

  if (params.data.scanId) {
    conditions.push(eq(findingsTable.scanId, params.data.scanId));
  }

  if (params.data.severity) {
    conditions.push(
      eq(findingsTable.severity, params.data.severity as typeof findingsTable.$inferSelect["severity"]),
    );
  }

  if (params.data.service) {
    conditions.push(
      eq(findingsTable.service, params.data.service as typeof findingsTable.$inferSelect["service"]),
    );
  }

  if (params.data.search) {
    conditions.push(
      ilike(findingsTable.title, `%${params.data.search}%`),
    );
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(findingsTable)
    .where(and(...conditions));

  const findings = await db
    .select()
    .from(findingsTable)
    .where(and(...conditions))
    .orderBy(findingsTable.id)
    .limit(limit)
    .offset(offset);

  res.json({
    data: findings.map((f) => ({
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
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  });
});

export default router;
