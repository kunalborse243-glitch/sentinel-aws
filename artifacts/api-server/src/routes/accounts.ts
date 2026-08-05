import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, awsAccountsTable } from "@workspace/db";
import {
  CreateAccountBody,
  UpdateAccountBody,
  GetAccountParams,
  UpdateAccountParams,
  DeleteAccountParams,
  TestAccountConnectionParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

const router: IRouter = Router();

// GET /accounts
router.get("/accounts", requireAuth, async (req, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(awsAccountsTable)
    .where(eq(awsAccountsTable.userId, req.user!.userId));

  res.json(
    accounts.map((a) => ({
      id: a.id,
      name: a.name,
      accessKeyId: a.accessKeyId,
      region: a.region,
      lastScanAt: a.lastScanAt?.toISOString() ?? null,
      lastScore: a.lastScore ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  );
});

// POST /accounts
router.post("/accounts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [account] = await db
    .insert(awsAccountsTable)
    .values({
      userId: req.user!.userId,
      name: parsed.data.name,
      accessKeyId: parsed.data.accessKeyId,
      secretAccessKey: parsed.data.secretAccessKey,
      region: parsed.data.region,
    })
    .returning();

  res.status(201).json({
    id: account.id,
    name: account.name,
    accessKeyId: account.accessKeyId,
    region: account.region,
    lastScanAt: null,
    lastScore: null,
    createdAt: account.createdAt.toISOString(),
  });
});

// GET /accounts/:id
router.get("/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const [account] = await db
    .select()
    .from(awsAccountsTable)
    .where(
      and(
        eq(awsAccountsTable.id, params.data.id),
        eq(awsAccountsTable.userId, req.user!.userId),
      ),
    );

  if (!account) {
    res.status(404).json({ error: "not_found", message: "Account not found" });
    return;
  }

  res.json({
    id: account.id,
    name: account.name,
    accessKeyId: account.accessKeyId,
    region: account.region,
    lastScanAt: account.lastScanAt?.toISOString() ?? null,
    lastScore: account.lastScore ?? null,
    createdAt: account.createdAt.toISOString(),
  });
});

// PUT /accounts/:id
router.put("/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const updates: Partial<typeof awsAccountsTable.$inferInsert> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.accessKeyId) updates.accessKeyId = parsed.data.accessKeyId;
  if (parsed.data.secretAccessKey) updates.secretAccessKey = parsed.data.secretAccessKey;
  if (parsed.data.region) updates.region = parsed.data.region;

  const [account] = await db
    .update(awsAccountsTable)
    .set(updates)
    .where(
      and(
        eq(awsAccountsTable.id, params.data.id),
        eq(awsAccountsTable.userId, req.user!.userId),
      ),
    )
    .returning();

  if (!account) {
    res.status(404).json({ error: "not_found", message: "Account not found" });
    return;
  }

  res.json({
    id: account.id,
    name: account.name,
    accessKeyId: account.accessKeyId,
    region: account.region,
    lastScanAt: account.lastScanAt?.toISOString() ?? null,
    lastScore: account.lastScore ?? null,
    createdAt: account.createdAt.toISOString(),
  });
});

// DELETE /accounts/:id
router.delete("/accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const [account] = await db
    .delete(awsAccountsTable)
    .where(
      and(
        eq(awsAccountsTable.id, params.data.id),
        eq(awsAccountsTable.userId, req.user!.userId),
      ),
    )
    .returning();

  if (!account) {
    res.status(404).json({ error: "not_found", message: "Account not found" });
    return;
  }

  res.sendStatus(204);
});

// POST /accounts/:id/test
router.post("/accounts/:id/test", requireAuth, async (req, res): Promise<void> => {
  const params = TestAccountConnectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const [account] = await db
    .select()
    .from(awsAccountsTable)
    .where(
      and(
        eq(awsAccountsTable.id, params.data.id),
        eq(awsAccountsTable.userId, req.user!.userId),
      ),
    );

  if (!account) {
    res.status(404).json({ error: "not_found", message: "Account not found" });
    return;
  }

  try {
    const sts = new STSClient({
      credentials: {
        accessKeyId: account.accessKeyId,
        secretAccessKey: account.secretAccessKey,
      },
      region: account.region,
    });

    const identity = await sts.send(new GetCallerIdentityCommand({}));
    res.json({
      success: true,
      accountId: identity.Account ?? null,
      message: `Connected as ${identity.Arn ?? "unknown"}`,
    });
  } catch (err) {
    res.json({
      success: false,
      accountId: null,
      message: err instanceof Error ? err.message : "Connection failed",
    });
  }
});

export default router;
