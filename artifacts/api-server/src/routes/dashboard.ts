import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, paymentsTable, artistsTable, reviewsTable } from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { requireAuth, AuthRequest, requireArtistRole } from "../middlewares/auth";

const router = Router();

// Safe integer parsing with bounds (OWASP A03)
function safeInt(val: unknown, fallback: number, max: number): number {
  const raw = Array.isArray(val) ? val[0] : typeof val === "string" ? val : undefined;
  const n = parseInt(raw ?? String(fallback), 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return Math.min(n, max);
}

router.get("/dashboard/stats", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const artistId = req.artistId!;

  const [artist, ordersByStatus, earningsResult, pendingResult] = await Promise.all([
    db.select().from(artistsTable).where(eq(artistsTable.id, artistId)).limit(1),
    db
      .select({ status: ordersTable.status, count: sql<number>`count(*)` })
      .from(ordersTable)
      .where(eq(ordersTable.artistId, artistId))
      .groupBy(ordersTable.status),
    db
      .select({ total: sql<number>`sum(${paymentsTable.amount})` })
      .from(paymentsTable)
      .innerJoin(ordersTable, eq(paymentsTable.orderId, ordersTable.id))
      .where(and(eq(ordersTable.artistId, artistId), eq(paymentsTable.status, "CONFIRMED"))),
    db
      .select({ total: sql<number>`sum(${paymentsTable.amount})` })
      .from(paymentsTable)
      .innerJoin(ordersTable, eq(paymentsTable.orderId, ordersTable.id))
      .where(and(eq(ordersTable.artistId, artistId), eq(paymentsTable.status, "PENDING"))),
  ]);

  const currentArtist = artist[0];
  const totalOrders = ordersByStatus.reduce((acc, s) => acc + Number(s.count), 0);
  const deliveredCount = Number(ordersByStatus.find((s) => s.status === "DELIVERED")?.count ?? 0);
  const cancelledCount = Number(ordersByStatus.find((s) => s.status === "CANCELLED")?.count ?? 0);
  const completionRate = totalOrders > 0 ? (deliveredCount / (totalOrders - cancelledCount)) * 100 : 0;

  res.json({
    totalEarnings: (Number(earningsResult[0]?.total ?? 0) / 100),
    pendingEarnings: (Number(pendingResult[0]?.total ?? 0) / 100),
    totalOrders,
    ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: Number(s.count) })),
    rating: Number(currentArtist?.rating ?? 0),
    totalReviews: currentArtist?.totalReviews ?? 0,
    availability: currentArtist?.availability ?? true,
    completionRate: Math.round(completionRate),
  });
});

router.get("/dashboard/recent-orders", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const limit = safeInt(req.query.limit, 10, 100);

  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.artistId, req.artistId!))
    .orderBy(sql`${ordersTable.createdAt} DESC`)
    .limit(limit);

  const now = new Date();
  const result = orders.map((o) => {
    const daysRemaining = Math.max(0, Math.ceil((o.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      id: o.id,
      title: o.title,
      clientName: o.clientName,
      clientEmail: o.clientEmail,
      status: o.status,
      basePrice: Number(o.basePrice),
      deadline: o.deadline,
      daysRemaining,
      createdAt: o.createdAt,
    };
  });

  res.json({ orders: result });
});

router.get("/dashboard/earnings", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const months = safeInt(req.query.months, 6, 24);
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const earningsData = await db
    .select({
      month: sql<string>`to_char(${ordersTable.createdAt}, 'Mon')`,
      year: sql<number>`extract(year from ${ordersTable.createdAt})`,
      monthNum: sql<number>`extract(month from ${ordersTable.createdAt})`,
      earnings: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)`,
      orderCount: sql<number>`count(distinct ${ordersTable.id})`,
    })
    .from(ordersTable)
    .leftJoin(
      paymentsTable,
      and(eq(paymentsTable.orderId, ordersTable.id), eq(paymentsTable.status, "CONFIRMED"))
    )
    .where(and(eq(ordersTable.artistId, req.artistId!), gte(ordersTable.createdAt, startDate)))
    .groupBy(sql`to_char(${ordersTable.createdAt}, 'Mon')`, sql`extract(year from ${ordersTable.createdAt})`, sql`extract(month from ${ordersTable.createdAt})`)
    .orderBy(sql`extract(year from ${ordersTable.createdAt})`, sql`extract(month from ${ordersTable.createdAt})`);

  const monthly = earningsData.map((d) => ({
    month: d.month,
    year: Number(d.year),
    earnings: Number(d.earnings) / 100,
    orderCount: Number(d.orderCount),
  }));

  const totalEarnings = monthly.reduce((acc, m) => acc + m.earnings, 0);
  const averageMonthly = monthly.length > 0 ? totalEarnings / monthly.length : 0;

  res.json({ monthly, totalEarnings, averageMonthly });
});

export default router;
