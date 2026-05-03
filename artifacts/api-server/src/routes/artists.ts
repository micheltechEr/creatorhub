import { Router } from "express";
import { db } from "@workspace/db";
import { artistsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { UpdateMeBody, ToggleAvailabilityBody } from "@workspace/api-zod";

const router = Router();

const formatArtist = (a: typeof artistsTable.$inferSelect) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  categories: a.categories,
  tags: a.tags,
  basePrice: Number(a.basePrice),
  deliveryDays: a.deliveryDays,
  availability: a.availability,
  rating: Number(a.rating),
  totalReviews: a.totalReviews,
  bio: a.bio ?? null,
  createdAt: a.createdAt,
});

router.get("/artists/me", requireAuth, async (req: AuthRequest, res) => {
  const [artist] = await db
    .select()
    .from(artistsTable)
    .where(eq(artistsTable.id, req.artistId!))
    .limit(1);

  if (!artist) {
    res.status(404).json({ error: "Not found", message: "Artista não encontrado" });
    return;
  }

  res.json(formatArtist(artist));
});

router.put("/artists/me", requireAuth, async (req: AuthRequest, res) => {
  const parse = UpdateMeBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const updates: Partial<typeof artistsTable.$inferInsert> = {};
  const data = parse.data;
  if (data.name !== undefined) updates.name = data.name;
  if (data.categories !== undefined) updates.categories = data.categories;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.basePrice !== undefined) updates.basePrice = String(data.basePrice);
  if (data.deliveryDays !== undefined) updates.deliveryDays = data.deliveryDays;
  if ((data as any).bio !== undefined) updates.bio = (data as any).bio;
  updates.updatedAt = new Date();

  const [artist] = await db
    .update(artistsTable)
    .set(updates)
    .where(eq(artistsTable.id, req.artistId!))
    .returning();

  res.json(formatArtist(artist));
});

router.patch("/artists/me/availability", requireAuth, async (req: AuthRequest, res) => {
  const parse = ToggleAvailabilityBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const [artist] = await db
    .update(artistsTable)
    .set({ availability: parse.data.availability, updatedAt: new Date() })
    .where(eq(artistsTable.id, req.artistId!))
    .returning();

  res.json(formatArtist(artist));
});

router.get("/artists", async (req, res) => {
  const { category, available, minPrice, maxPrice, limit = "20", offset = "0" } = req.query as Record<string, string>;

  const conditions = [];
  if (category) conditions.push(sql`${category} = ANY(${artistsTable.categories})`);
  if (available !== undefined) conditions.push(eq(artistsTable.availability, available === "true"));
  if (minPrice) conditions.push(gte(artistsTable.basePrice, minPrice));
  if (maxPrice) conditions.push(lte(artistsTable.basePrice, maxPrice));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [artists, countResult] = await Promise.all([
    db.select().from(artistsTable).where(whereClause).limit(Number(limit)).offset(Number(offset)),
    db.select({ count: sql<number>`count(*)` }).from(artistsTable).where(whereClause),
  ]);

  res.json({
    artists: artists.map(formatArtist),
    total: Number(countResult[0]?.count ?? 0),
  });
});

router.get("/artists/:id", async (req, res) => {
  const [artist] = await db
    .select()
    .from(artistsTable)
    .where(eq(artistsTable.id, req.params.id))
    .limit(1);

  if (!artist) {
    res.status(404).json({ error: "Not found", message: "Artista não encontrado" });
    return;
  }

  res.json(formatArtist(artist));
});

export default router;
