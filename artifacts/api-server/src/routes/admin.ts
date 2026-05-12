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
import { eq, sql, count, and, ilike, or } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

// Safe integer parsing with bounds (OWASP A03)
function safeInt(val: unknown, fallback: number, max: number): number {
  const raw = Array.isArray(val) ? val[0] : typeof val === "string" ? val : undefined;
  const n = parseInt(raw ?? String(fallback), 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return Math.min(n, max);
}

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
      .where(eq(artistsTable.availability, true)),
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
        availability: artistsTable.availability,
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
  const limit = safeInt(req.query.limit, 50, 200);
  const offset = safeInt(req.query.offset, 0, 100_000);
  const search = (req.query.search as string) ?? "";

  // Build WHERE clause — filter at SQL level instead of JS (OWASP A03 injection + performance)
  const conditions = [];
  if (search) {
    const sanitized = search.replace(/[%_]/g, "\\$&"); // Escape SQL LIKE wildcards
    conditions.push(
      or(
        ilike(artistsTable.name, `%${sanitized}%`),
        ilike(artistsTable.email, `%${sanitized}%`),
      ),
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [artists, totalResult] = await Promise.all([
    db
      .select({
        id: artistsTable.id,
        name: artistsTable.name,
        email: artistsTable.email,
        categories: artistsTable.categories,
        basePrice: artistsTable.basePrice,
        availability: artistsTable.availability,
        rating: artistsTable.rating,
        totalReviews: artistsTable.totalReviews,
        createdAt: artistsTable.createdAt,
      })
      .from(artistsTable)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${artistsTable.createdAt} DESC`),
    db
      .select({ count: count() })
      .from(artistsTable)
      .where(whereClause),
  ]);

  res.json({
    artists: artists.map((a) => ({
      ...a,
      basePrice: Number(a.basePrice),
      rating: Number(a.rating),
    })),
    total: Number(totalResult[0]?.count ?? 0),
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
      availability: true,
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

// ── GET /admin/users — all platform users with filters ───────────────────────
router.get("/admin/users", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const search = (req.query.search as string) ?? "";
  const roleFilter = (req.query.role as string) ?? "";

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(platformUsersTable.name, `%${search}%`),
        ilike(platformUsersTable.email, `%${search}%`),
      ),
    );
  }

  if (roleFilter && ["superadmin", "artist", "client"].includes(roleFilter)) {
    conditions.push(eq(platformUsersTable.role, roleFilter as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [users, totalResult] = await Promise.all([
    db
      .select({
        id: platformUsersTable.id,
        clerkUserId: platformUsersTable.clerkUserId,
        email: platformUsersTable.email,
        name: platformUsersTable.name,
        role: platformUsersTable.role,
        tenantId: platformUsersTable.tenantId,
        createdAt: platformUsersTable.createdAt,
        updatedAt: platformUsersTable.updatedAt,
        // Join artist info when applicable
        artistName: artistsTable.name,
        artistAvailability: artistsTable.availability,
      })
      .from(platformUsersTable)
      .leftJoin(artistsTable, eq(platformUsersTable.tenantId, artistsTable.id))
      .where(whereClause)
      .orderBy(sql`${platformUsersTable.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(platformUsersTable)
      .where(whereClause),
  ]);

  res.json({
    users: users.map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      email: u.email,
      name: u.name,
      role: u.role,
      tenantId: u.tenantId,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      tenant: u.tenantId
        ? {
            id: u.tenantId,
            name: u.artistName,
            availability: u.artistAvailability,
          }
        : null,
    })),
    total: Number(totalResult[0]?.count ?? 0),
  });
});

// ── GET /admin/users/:id — single platform user detail ──────────────────────
router.get("/admin/users/:id", async (req, res) => {
  const [user] = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.id, req.params.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Not found", message: "Usuário não encontrado" });
    return;
  }

  // If user has a tenant (artist role), fetch tenant details + stats
  let tenant = null;
  let orderStats = null;

  if (user.tenantId) {
    const [artist] = await db
      .select()
      .from(artistsTable)
      .where(eq(artistsTable.id, user.tenantId))
      .limit(1);

    if (artist) {
      const stats = await db
        .select({ status: ordersTable.status, count: count() })
        .from(ordersTable)
        .where(eq(ordersTable.artistId, user.tenantId))
        .groupBy(ordersTable.status);

      const [clientCount] = await db
        .select({ count: count() })
        .from(tenantClientsTable)
        .where(eq(tenantClientsTable.tenantId, user.tenantId));

      tenant = {
        id: artist.id,
        name: artist.name,
        email: artist.email,
        categories: artist.categories,
        basePrice: Number(artist.basePrice),
        availability: artist.availability,
        rating: Number(artist.rating),
        totalReviews: artist.totalReviews,
        createdAt: artist.createdAt,
      };

      orderStats = {
        byStatus: stats.map((s) => ({ status: s.status, count: Number(s.count) })),
        totalClients: Number(clientCount[0]?.count ?? 0),
      };
    }
  }

  res.json({
    id: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    tenant,
    orderStats,
  });
});

// ── PATCH /admin/users/:id/role — change user role ──────────────────────────
router.patch("/admin/users/:id/role", async (req, res) => {
  const { role } = req.body;

  if (!role || !["superadmin", "artist", "client"].includes(role)) {
    res.status(400).json({
      error: "Validation error",
      message: "Papel inválido. Use: superadmin, artist ou client",
    });
    return;
  }

  const [user] = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.id, req.params.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Not found", message: "Usuário não encontrado" });
    return;
  }

  // Prevent removing the last superadmin
  if (user.role === "superadmin" && role !== "superadmin") {
    const [superadminCount] = await db
      .select({ count: count() })
      .from(platformUsersTable)
      .where(eq(platformUsersTable.role, "superadmin"));

    if (Number(superadminCount[0]?.count ?? 0) <= 1) {
      res.status(400).json({
        error: "Forbidden",
        message: "Não é possível remover o último superadmin da plataforma",
      });
      return;
    }
  }

  const [updated] = await db
    .update(platformUsersTable)
    .set({ role: role as any, updatedAt: new Date() })
    .where(eq(platformUsersTable.id, req.params.id))
    .returning();

  res.json({
    message: `Papel do usuário alterado para ${role}`,
    id: updated.id,
    email: updated.email,
    role: updated.role,
  });
});

// ── DELETE /admin/users/:id — remove a platform user ────────────────────────
router.delete("/admin/users/:id", async (req, res) => {
  const [user] = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.id, req.params.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Not found", message: "Usuário não encontrado" });
    return;
  }

  // Prevent deleting the last superadmin
  if (user.role === "superadmin") {
    const [superadminCount] = await db
      .select({ count: count() })
      .from(platformUsersTable)
      .where(eq(platformUsersTable.role, "superadmin"));

    if (Number(superadminCount[0]?.count ?? 0) <= 1) {
      res.status(400).json({
        error: "Forbidden",
        message: "Não é possível remover o último superadmin da plataforma",
      });
      return;
    }
  }

  await db.delete(platformUsersTable).where(eq(platformUsersTable.id, req.params.id));

  res.json({ message: "Usuário removido da plataforma", id: req.params.id });
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
