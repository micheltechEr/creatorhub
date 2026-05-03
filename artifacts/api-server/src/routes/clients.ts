import { Router } from "express";
import { db } from "@workspace/db";
import { tenantClientsTable, ordersTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import { requireAuth, requireArtistRole, AuthRequest } from "../middlewares/auth";

const router = Router();

// ── GET /clients — list artist's clients ──────────────────────────────────────
router.get("/clients", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const tenantId = req.tenantId!;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const search = (req.query.search as string) ?? "";

  const clients = await db
    .select()
    .from(tenantClientsTable)
    .where(eq(tenantClientsTable.tenantId, tenantId))
    .orderBy(sql`${tenantClientsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  const filtered = search
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()),
      )
    : clients;

  const [totalResult] = await db
    .select({ count: count() })
    .from(tenantClientsTable)
    .where(eq(tenantClientsTable.tenantId, tenantId));

  res.json({
    clients: filtered.map((c) => ({
      ...c,
      totalSpent: Number(c.totalSpent),
    })),
    total: Number(totalResult?.count ?? 0),
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
