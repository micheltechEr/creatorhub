import { Router } from "express";
import { db } from "@workspace/db";
import { artistsTable, platformUsersTable, asaasAccountsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, AuthRequest, requireArtistRole } from "../middlewares/auth";
import { UpdateMeBody, ToggleAvailabilityBody } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { findOrCreateCustomer } from "../lib/asaas";

const router = Router();

const OnboardBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  categories: z.array(z.string()).min(1),
  tags: z.array(z.string()).optional(),
  basePrice: z.number().positive(),
  deliveryDays: z.number().int().min(1).max(180),
  bio: z.string().optional(),
});

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

// ── POST /artists/onboard — create artist profile for a new Clerk user ────────
router.post("/artists/onboard", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Autenticação necessária" });
    return;
  }

  // If profile already exists, return it (idempotent)
  const [existing] = await db
    .select()
    .from(artistsTable)
    .where(eq(artistsTable.clerkUserId, auth.userId))
    .limit(1);

  if (existing) {
    res.json(formatArtist(existing));
    return;
  }

  const parse = OnboardBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const { name, email, categories, tags, basePrice, deliveryDays, bio } = parse.data;

  // Check if this email is already taken by another user
  const [emailTaken] = await db
    .select({ id: artistsTable.id })
    .from(artistsTable)
    .where(eq(artistsTable.email, email))
    .limit(1);

  if (emailTaken) {
    // Link the existing account to this Clerk user instead
    const [linked] = await db
      .update(artistsTable)
      .set({ clerkUserId: auth.userId, updatedAt: new Date() })
      .where(eq(artistsTable.email, email))
      .returning();

    // Ensure platform_users record exists for this artist
    await db
      .insert(platformUsersTable)
      .values({
        clerkUserId: auth.userId,
        email: linked.email,
        name: linked.name,
        role: "artist",
        tenantId: linked.id,
      })
      .onConflictDoUpdate({
        target: platformUsersTable.clerkUserId,
        set: { tenantId: linked.id, name: linked.name, role: "artist", updatedAt: new Date() },
      });

    res.json(formatArtist(linked));
    return;
  }

  const [artist] = await db
    .insert(artistsTable)
    .values({
      name,
      email,
      clerkUserId: auth.userId,
      categories,
      tags: tags ?? [],
      basePrice: String(basePrice),
      deliveryDays,
      availability: true,
      bio: bio ?? null,
    })
    .returning();

  // Create platform_users record (multi-tenant role tracking)
  await db
    .insert(platformUsersTable)
    .values({
      clerkUserId: auth.userId,
      email,
      name,
      role: "artist",
      tenantId: artist.id,
    })
    .onConflictDoUpdate({
      target: platformUsersTable.clerkUserId,
      set: {
        tenantId: artist.id,
        name,
        role: "artist",
        updatedAt: new Date(),
      },
    });

  res.status(201).json(formatArtist(artist));
});

// ── GET /artists/me ───────────────────────────────────────────────────────────
router.get("/artists/me", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
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

// ── PUT /artists/me ───────────────────────────────────────────────────────────
router.put("/artists/me", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
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

// ── PATCH /artists/me/availability ────────────────────────────────────────────
router.patch("/artists/me/availability", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
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

// ── GET /artists — public listing ─────────────────────────────────────────────
router.get("/artists", async (req, res) => {
  const { category, available, minPrice, maxPrice, limit = "20", offset = "0" } =
    req.query as Record<string, string>;

  const conditions = [];
  if (category) conditions.push(sql`${category} = ANY(${artistsTable.categories})`);
  if (available !== undefined)
    conditions.push(eq(artistsTable.availability, available === "true"));
  if (minPrice) conditions.push(gte(artistsTable.basePrice, minPrice));
  if (maxPrice) conditions.push(lte(artistsTable.basePrice, maxPrice));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [artists, countResult] = await Promise.all([
    db
      .select()
      .from(artistsTable)
      .where(whereClause)
      .limit(Math.min(Number(limit), 100))
      .offset(Math.max(Number(offset), 0)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(artistsTable)
      .where(whereClause),
  ]);

  res.json({
    artists: artists.map(formatArtist),
    total: Number(countResult[0]?.count ?? 0),
  });
});

// ── POST /artists/me/connect-asaas — connect artist to Asaas payment gateway ─
router.post("/artists/me/connect-asaas", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  try {
    const [artist] = await db
      .select()
      .from(artistsTable)
      .where(eq(artistsTable.id, req.artistId!))
      .limit(1);

    if (!artist) {
      res.status(404).json({ error: "Not found", message: "Artista não encontrado" });
      return;
    }

    // Check if already connected
    const [existingAccount] = await db
      .select()
      .from(asaasAccountsTable)
      .where(eq(asaasAccountsTable.artistId, artist.id))
      .limit(1);

    if (existingAccount) {
      res.json({ walletId: existingAccount.walletId, status: existingAccount.status });
      return;
    }

    // Create customer in Asaas
    const customer = await findOrCreateCustomer({
      name: artist.name,
      email: artist.email,
    });

    // Persist the relationship
    const [account] = await db
      .insert(asaasAccountsTable)
      .values({
        artistId: artist.id,
        asaasCustomerId: customer.id,
        walletId: customer.id, // Asaas uses customer ID as wallet reference
        status: "ACTIVE",
      })
      .returning();

    res.json({ walletId: account.walletId, status: account.status });
  } catch (err: any) {
    res.status(500).json({ error: "Asaas error", message: err.message ?? "Falha ao conectar ao Asaas" });
  }
});

// ── GET /artists/:id — public profile ─────────────────────────────────────────
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
