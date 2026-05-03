import { Router } from "express";
import { db } from "@workspace/db";
import {
  artistsTable,
  platformUsersTable,
  ordersTable,
  paymentsTable,
  reviewsTable,
  tenantClientsTable,
} from "@workspace/db";
import { eq, sql, count, and } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, AuthRequest } from "../middlewares/auth";

const router = Router();

// All admin routes require auth + superadmin role
router.use(requireAuth, requireSuperAdmin);

// ── GET /admin/stats — platform-wide analytics ────────────────────────────────
router.get("/admin/stats", async (_req, res) => {
  const [
    totalArtists,
    activeArtists,
    totalOrders,
    ordersByStatus,
    totalRevenue,
    totalClients,
    recentArtists,
  ] = await Promise.all([
    db.select({ count: count() }).from(artistsTable),
    db
      .select({ count: count() })
      .from(artistsTable)
      .where(eq((artistsTable as any).isActive, true)),
    db.select({ count: count() }).from(ordersTable),
    db
      .select({ status: ordersTable.status, count: count() })
      .from(ordersTable)
      .groupBy(ordersTable.status),
    db
      .select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "CONFIRMED")),
    db.select({ count: count() }).from(tenantClientsTable),
    db
      .select({
        id: artistsTable.id,
        name: artistsTable.name,
        email: artistsTable.email,
        createdAt: artistsTable.createdAt,
        isActive: (artistsTable as any).isActive,
      })
      .from(artistsTable)
      .orderBy(sql`${artistsTable.createdAt} DESC`)
      .limit(5),
  ]);

  res.json({
    totalArtists: Number(totalArtists[0]?.count ?? 0),
    activeArtists: Number(activeArtists[0]?.count ?? 0),
    suspendedArtists:
      Number(totalArtists[0]?.count ?? 0) - Number(activeArtists[0]?.count ?? 0),
    totalOrders: Number(totalOrders[0]?.count ?? 0),
    ordersByStatus: ordersByStatus.map((s) => ({
      status: s.status,
      count: Number(s.count),
    })),
    totalRevenue: Number(totalRevenue[0]?.total ?? 0) / 100,
    totalClients: Number(totalClients[0]?.count ?? 0),
    recentArtists,
  });
});

// ── GET /admin/artists — all artists with stats ────────────────────────────────
router.get("/admin/artists", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const search = (req.query.search as string) ?? "";

  const artists = await db
    .select({
      id: artistsTable.id,
      name: artistsTable.name,
      email: artistsTable.email,
      categories: artistsTable.categories,
      basePrice: artistsTable.basePrice,
      availability: artistsTable.availability,
      rating: artistsTable.rating,
      totalReviews: artistsTable.totalReviews,
      isActive: (artistsTable as any).isActive,
      suspendedAt: (artistsTable as any).suspendedAt,
      suspendedReason: (artistsTable as any).suspendedReason,
      createdAt: artistsTable.createdAt,
    })
    .from(artistsTable)
    .limit(limit)
    .offset(offset)
    .orderBy(sql`${artistsTable.createdAt} DESC`);

  // Filter by search in JS (simple approach for small datasets)
  const filtered = search
    ? artists.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.email.toLowerCase().includes(search.toLowerCase()),
      )
    : artists;

  const [totalResult] = await db
    .select({ count: count() })
    .from(artistsTable);

  res.json({
    artists: filtered.map((a) => ({
      ...a,
      basePrice: Number(a.basePrice),
      rating: Number(a.rating),
    })),
    total: Number(totalResult?.count ?? 0),
  });
});

// ── GET /admin/artists/:id — single artist detail ─────────────────────────────
router.get("/admin/artists/:id", async (req, res) => {
  const [artist] = await db
    .select()
    .from(artistsTable)
    .where(eq(artistsTable.id, req.params.id))
    .limit(1);

  if (!artist) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [orderStats, clientCount] = await Promise.all([
    db
      .select({ status: ordersTable.status, count: count() })
      .from(ordersTable)
      .where(eq(ordersTable.artistId, req.params.id))
      .groupBy(ordersTable.status),
    db
      .select({ count: count() })
      .from(tenantClientsTable)
      .where(eq(tenantClientsTable.tenantId, req.params.id)),
  ]);

  res.json({
    id: artist.id,
    name: artist.name,
    email: artist.email,
    categories: artist.categories,
    tags: artist.tags,
    basePrice: Number(artist.basePrice),
    deliveryDays: artist.deliveryDays,
    availability: artist.availability,
    rating: Number(artist.rating),
    totalReviews: artist.totalReviews,
    isActive: (artist as any).isActive ?? true,
    suspendedAt: (artist as any).suspendedAt ?? null,
    suspendedReason: (artist as any).suspendedReason ?? null,
    bio: artist.bio,
    createdAt: artist.createdAt,
    orderStats: orderStats.map((s) => ({ status: s.status, count: Number(s.count) })),
    totalClients: Number(clientCount[0]?.count ?? 0),
  });
});

// ── PATCH /admin/artists/:id/suspend — suspend a tenant ───────────────────────
router.patch("/admin/artists/:id/suspend", async (req, res) => {
  const { reason } = req.body;

  const [artist] = await db
    .update(artistsTable)
    .set({
      isActive: false as any,
      suspendedAt: new Date() as any,
      suspendedReason: (reason ?? "Suspenso pelo administrador") as any,
      availability: false,
      updatedAt: new Date(),
    })
    .where(eq(artistsTable.id, req.params.id))
    .returning();

  if (!artist) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ message: "Artista suspenso com sucesso", id: req.params.id });
});

// ── PATCH /admin/artists/:id/activate — restore a suspended tenant ─────────────
router.patch("/admin/artists/:id/activate", async (req, res) => {
  const [artist] = await db
    .update(artistsTable)
    .set({
      isActive: true as any,
      suspendedAt: null as any,
      suspendedReason: null as any,
      updatedAt: new Date(),
    })
    .where(eq(artistsTable.id, req.params.id))
    .returning();

  if (!artist) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ message: "Artista ativado com sucesso", id: req.params.id });
});

// ── DELETE /admin/artists/:id — permanently delete a tenant ───────────────────
router.delete("/admin/artists/:id", async (req, res) => {
  // Cascade deletes orders, media, reviews, tenant_clients via FK
  await db.delete(artistsTable).where(eq(artistsTable.id, req.params.id));
  res.json({ message: "Artista removido permanentemente", id: req.params.id });
});

// ── GET /admin/orders — all orders across all tenants ─────────────────────────
router.get("/admin/orders", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  const [orders, totalResult] = await Promise.all([
    db
      .select({
        id: ordersTable.id,
        title: ordersTable.title,
        clientName: ordersTable.clientName,
        clientEmail: ordersTable.clientEmail,
        status: ordersTable.status,
        basePrice: ordersTable.basePrice,
        deadline: ordersTable.deadline,
        createdAt: ordersTable.createdAt,
        artistId: ordersTable.artistId,
        artistName: artistsTable.name,
        artistEmail: artistsTable.email,
      })
      .from(ordersTable)
      .leftJoin(artistsTable, eq(ordersTable.artistId, artistsTable.id))
      .orderBy(sql`${ordersTable.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(ordersTable),
  ]);

  res.json({
    orders: orders.map((o) => ({
      ...o,
      basePrice: Number(o.basePrice),
    })),
    total: Number(totalResult[0]?.count ?? 0),
  });
});

export default router;
