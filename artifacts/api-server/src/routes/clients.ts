import { Router } from "express";
import { db } from "@workspace/db";
import { tenantClientsTable, ordersTable } from "@workspace/db";
import { eq, and, sql, count, ilike, or } from "drizzle-orm";
import { requireAuth, requireArtistRole, AuthRequest } from "../middlewares/auth";

const router = Router();

// Safe integer parsing with bounds (OWASP A03)
function safeInt(val: unknown, fallback: number, max: number): number {
  const raw = Array.isArray(val) ? val[0] : typeof val === "string" ? val : undefined;
  const n = parseInt(raw ?? String(fallback), 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return Math.min(n, max);
}

// ── GET /clients — list artist's clients ──────────────────────────────────────
router.get("/clients", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const tenantId = req.tenantId!;
  const limit = safeInt(req.query.limit, 50, 200);
  const offset = safeInt(req.query.offset, 0, 100_000);
  const search = (req.query.search as string) ?? "";

  // Build WHERE clause — filter at SQL level instead of JS (OWASP A03 injection + performance)
  const conditions = [eq(tenantClientsTable.tenantId, tenantId)];
  if (search) {
    const sanitized = search.replace(/[%_]/g, "\\$&"); // Escape SQL LIKE wildcards
    conditions.push(
      or(
        ilike(tenantClientsTable.name, `%${sanitized}%`),
        ilike(tenantClientsTable.email, `%${sanitized}%`),
      ) as any,
    );
  }
  const whereClause = and(...conditions);

  const [clients, totalResult] = await Promise.all([
    db
      .select()
      .from(tenantClientsTable)
      .where(whereClause)
      .orderBy(sql`${tenantClientsTable.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(tenantClientsTable)
      .where(whereClause),
  ]);

  res.json({
    clients: clients.map((c) => ({
      ...c,
      totalSpent: Number(c.totalSpent),
    })),
    total: Number(totalResult[0]?.count ?? 0),
  });
});

// ── GET /clients/:id — client detail with their orders ───────────────────────
router.get("/clients/:id", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const tenantId = req.tenantId!;

  const [client] = await db
    .select()
    .from(tenantClientsTable)
    .where(
      and(
        eq(tenantClientsTable.id, req.params.id),
        eq(tenantClientsTable.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!client) {
    res.status(404).json({ error: "Not found", message: "Cliente não encontrado" });
    return;
  }

  // Fetch this client's orders with this artist
  const orders = await db
    .select({
      id: ordersTable.id,
      title: ordersTable.title,
      status: ordersTable.status,
      basePrice: ordersTable.basePrice,
      deadline: ordersTable.deadline,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.artistId, tenantId),
        eq(ordersTable.clientEmail, client.email),
      ),
    )
    .orderBy(sql`${ordersTable.createdAt} DESC`);

  res.json({
    ...client,
    totalSpent: Number(client.totalSpent),
    orders: orders.map((o) => ({ ...o, basePrice: Number(o.basePrice) })),
  });
});

// ── POST /clients — manually create a client ──────────────────────────────────
router.post("/clients", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const tenantId = req.tenantId!;
  const { name, email, phone, notes } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: "Validation error", message: "Nome e email são obrigatórios" });
    return;
  }

  const [client] = await db
    .insert(tenantClientsTable)
    .values({ tenantId, name, email, phone: phone ?? null, notes: notes ?? null })
    .onConflictDoUpdate({
      target: [tenantClientsTable.tenantId, tenantClientsTable.email],
      set: {
        name,
        phone: phone ?? null,
        notes: notes ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.status(201).json({ ...client, totalSpent: Number(client.totalSpent) });
});

// ── PUT /clients/:id — update client notes/phone ─────────────────────────────
router.put("/clients/:id", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const tenantId = req.tenantId!;
  const { name, phone, notes } = req.body;

  const [client] = await db
    .update(tenantClientsTable)
    .set({
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(notes !== undefined && { notes }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tenantClientsTable.id, req.params.id),
        eq(tenantClientsTable.tenantId, tenantId),
      ),
    )
    .returning();

  if (!client) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ ...client, totalSpent: Number(client.totalSpent) });
});

// ── DELETE /clients/:id — remove a client record ─────────────────────────────
router.delete("/clients/:id", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const tenantId = req.tenantId!;

  await db
    .delete(tenantClientsTable)
    .where(
      and(
        eq(tenantClientsTable.id, req.params.id),
        eq(tenantClientsTable.tenantId, tenantId),
      ),
    );

  res.json({ message: "Cliente removido", id: req.params.id });
});

export default router;
