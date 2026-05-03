import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, ordersTable, artistsTable } from "@workspace/db";
import { eq, sql, avg } from "drizzle-orm";
import { CreateReviewBody } from "@workspace/api-zod";
import { reviewLimiter } from "../lib/rate-limiters";

const router = Router();

// Safe integer parsing with bounds
function safeInt(val: string | undefined, fallback: number, max: number): number {
  const n = parseInt(val ?? String(fallback), 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return Math.min(n, max);
}

// ── POST /reviews ─────────────────────────────────────────────────────────────
// Public endpoint — rate-limited. Validates order ownership via clientId.
router.post("/reviews", reviewLimiter, async (req, res) => {
  const parse = CreateReviewBody.safeParse(req.body);
  if (!parse.success) {
    res
      .status(400)
      .json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const { orderId, clientId, rating, comment } = parse.data;

  // Fetch the order — must exist and be DELIVERED
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order || order.status !== "DELIVERED") {
    res.status(400).json({
      error: "Bad request",
      message: "Pedido deve estar entregue para criar avaliação",
    });
    return;
  }

  // Validate clientId belongs to this order (OWASP A01)
  if (order.clientId !== clientId) {
    res.status(403).json({
      error: "Forbidden",
      message: "Você não tem permissão para avaliar este pedido",
    });
    return;
  }

  // Prevent duplicate reviews
  const [existing] = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(eq(reviewsTable.orderId, orderId))
    .limit(1);

  if (existing) {
    res.status(400).json({
      error: "Already exists",
      message: "Avaliação já existe para este pedido",
    });
    return;
  }

  const [review] = await db
    .insert(reviewsTable)
    .values({
      orderId,
      artistId: order.artistId,
      clientId,
      rating,
      comment: comment ?? "",
    })
    .returning();

  // Update artist rating aggregate
  const ratingResult = await db
    .select({ avg: avg(reviewsTable.rating), count: sql<number>`count(*)` })
    .from(reviewsTable)
    .where(eq(reviewsTable.artistId, order.artistId));

  const newRating = Number(ratingResult[0]?.avg ?? 0).toFixed(2);
  const newTotal = Number(ratingResult[0]?.count ?? 0);

  await db
    .update(artistsTable)
    .set({ rating: newRating, totalReviews: newTotal, updatedAt: new Date() })
    .where(eq(artistsTable.id, order.artistId));

  res.status(201).json({
    id: review.id,
    orderId: review.orderId,
    artistId: review.artistId,
    clientId: review.clientId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  });
});

// ── GET /reviews/artist/:artistId ─────────────────────────────────────────────
router.get("/reviews/artist/:artistId", async (req, res) => {
  const { limit, offset } = req.query as Record<string, string>;
  const safeLimit = safeInt(limit, 20, 100);
  const safeOffset = safeInt(offset, 0, 100_000);

  const [reviews, countResult, avgResult] = await Promise.all([
    db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.artistId, req.params.artistId as string))
      .limit(safeLimit)
      .offset(safeOffset)
      .orderBy(sql`${reviewsTable.createdAt} DESC`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(reviewsTable)
      .where(eq(reviewsTable.artistId, req.params.artistId as string)),
    db
      .select({ avg: avg(reviewsTable.rating) })
      .from(reviewsTable)
      .where(eq(reviewsTable.artistId, req.params.artistId as string)),
  ]);

  res.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      artistId: r.artistId,
      clientId: r.clientId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    total: Number(countResult[0]?.count ?? 0),
    averageRating: Number(avgResult[0]?.avg ?? 0),
  });
});

export default router;
