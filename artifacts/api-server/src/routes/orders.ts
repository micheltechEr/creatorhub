import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, artistsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { CreateOrderBody, UpdateOrderStatusBody } from "@workspace/api-zod";

const router = Router();

const ORDER_TRANSITIONS: Record<string, string[]> = {
  PROPOSED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "PROPOSED"],
  PAID: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const formatOrder = (o: typeof ordersTable.$inferSelect) => ({
  id: o.id,
  clientId: o.clientId,
  artistId: o.artistId,
  title: o.title,
  description: o.description,
  occasion: o.occasion,
  names: o.names,
  referenceLinks: o.referenceLinks,
  deadline: o.deadline,
  additionalInstructions: o.additionalInstructions,
  basePrice: Number(o.basePrice),
  status: o.status,
  clientName: o.clientName,
  clientEmail: o.clientEmail,
  deliveryVideoUrl: o.deliveryVideoUrl,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});

router.get("/orders", requireAuth, async (req: AuthRequest, res) => {
  const { status, limit = "20", offset = "0" } = req.query as Record<string, string>;

  const conditions = [eq(ordersTable.artistId, req.artistId!)];
  if (status) conditions.push(eq(ordersTable.status, status as any));

  const [orders, countResult] = await Promise.all([
    db.select().from(ordersTable).where(and(...conditions)).limit(Number(limit)).offset(Number(offset)).orderBy(sql`${ordersTable.createdAt} DESC`),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(and(...conditions)),
  ]);

  res.json({
    orders: orders.map(formatOrder),
    total: Number(countResult[0]?.count ?? 0),
  });
});

router.post("/orders", async (req, res) => {
  const parse = CreateOrderBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const data = parse.data;

  const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.id, data.artistId)).limit(1);
  if (!artist) {
    res.status(404).json({ error: "Not found", message: "Artista não encontrado" });
    return;
  }

  const [order] = await db.insert(ordersTable).values({
    clientId: data.artistId, // placeholder — in real system this would be a separate clients table
    artistId: data.artistId,
    title: data.title,
    description: data.description,
    occasion: data.occasion,
    names: data.names ?? [],
    referenceLinks: data.referenceLinks ?? [],
    deadline: new Date(data.deadline),
    additionalInstructions: data.additionalInstructions,
    basePrice: String(data.basePrice ?? Number(artist.basePrice)),
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    status: "PROPOSED",
  }).returning();

  res.status(201).json(formatOrder(order));
});

router.get("/orders/:id", requireAuth, async (req: AuthRequest, res) => {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.artistId, req.artistId!)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Not found", message: "Pedido não encontrado" });
    return;
  }

  res.json(formatOrder(order));
});

router.patch("/orders/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const parse = UpdateOrderStatusBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.artistId, req.artistId!)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Not found", message: "Pedido não encontrado" });
    return;
  }

  const allowed = ORDER_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(parse.data.status)) {
    res.status(400).json({
      error: "Invalid transition",
      message: `Transição inválida de ${existing.status} para ${parse.data.status}`,
    });
    return;
  }

  const updates: Partial<typeof ordersTable.$inferInsert> = {
    status: parse.data.status as any,
    updatedAt: new Date(),
  };
  if (parse.data.deliveryVideoUrl) {
    updates.deliveryVideoUrl = parse.data.deliveryVideoUrl;
  }

  const [updated] = await db
    .update(ordersTable)
    .set(updates)
    .where(eq(ordersTable.id, req.params.id))
    .returning();

  res.json(formatOrder(updated));
});

export default router;
