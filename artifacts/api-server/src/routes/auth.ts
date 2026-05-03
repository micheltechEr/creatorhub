import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { artistsTable, refreshTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody, RefreshTokenBody } from "@workspace/api-zod";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "dev-refresh-secret";

const generateTokens = (artistId: string, email: string) => {
  const accessToken = jwt.sign({ id: artistId, email, role: "artist" }, JWT_SECRET, {
    expiresIn: "30m",
    algorithm: "HS256",
  });
  const refreshToken = jwt.sign(
    { userId: artistId, type: "refresh" },
    REFRESH_SECRET,
    { expiresIn: "7d", algorithm: "HS256" }
  );
  return { accessToken, refreshToken };
};

router.post("/auth/register", async (req, res) => {
  const parse = RegisterBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const { name, email, password, categories, tags, basePrice, deliveryDays } = parse.data;

  const existing = await db.select().from(artistsTable).where(eq(artistsTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered", message: "Email já cadastrado" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const [artist] = await db.insert(artistsTable).values({
    name,
    email,
    hashedPassword,
    categories,
    tags: tags ?? [],
    basePrice: String(basePrice),
    deliveryDays,
    availability: true,
  }).returning();

  const { accessToken, refreshToken } = generateTokens(artist.id, artist.email);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokensTable).values({
    token: refreshToken,
    artistId: artist.id,
    expiresAt,
  });

  res.status(201).json({
    accessToken,
    refreshToken,
    expiresIn: 1800,
    user: { id: artist.id, email: artist.email, name: artist.name },
  });
});

router.post("/auth/login", async (req, res) => {
  const parse = LoginBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const { email, password } = parse.data;

  const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.email, email)).limit(1);
  if (!artist) {
    res.status(401).json({ error: "Unauthorized", message: "Email ou senha incorretos" });
    return;
  }

  const match = await bcrypt.compare(password, artist.hashedPassword);
  if (!match) {
    res.status(401).json({ error: "Unauthorized", message: "Email ou senha incorretos" });
    return;
  }

  const { accessToken, refreshToken } = generateTokens(artist.id, artist.email);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokensTable).values({
    token: refreshToken,
    artistId: artist.id,
    expiresAt,
  });

  res.json({
    accessToken,
    refreshToken,
    expiresIn: 1800,
    user: { id: artist.id, email: artist.email, name: artist.name },
  });
});

router.post("/auth/refresh", async (req, res) => {
  const parse = RefreshTokenBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const { refreshToken } = parse.data;

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string; type: string };
    if (decoded.type !== "refresh") {
      res.status(401).json({ error: "Unauthorized", message: "Token tipo inválido" });
      return;
    }

    const [stored] = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.token, refreshToken))
      .limit(1);

    if (!stored || stored.isRevoked) {
      res.status(401).json({ error: "Unauthorized", message: "Refresh token revogado" });
      return;
    }

    const [artist] = await db
      .select()
      .from(artistsTable)
      .where(eq(artistsTable.id, decoded.userId))
      .limit(1);

    if (!artist) {
      res.status(401).json({ error: "Unauthorized", message: "Artista não encontrado" });
      return;
    }

    const accessToken = jwt.sign(
      { id: artist.id, email: artist.email, role: "artist" },
      JWT_SECRET,
      { expiresIn: "30m", algorithm: "HS256" }
    );

    res.json({ accessToken, expiresIn: 1800 });
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Refresh token inválido" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      await db
        .update(refreshTokensTable)
        .set({ isRevoked: true })
        .where(eq(refreshTokensTable.token, token));
    } catch { /* ignore */ }
  }
  res.json({ message: "Logged out successfully" });
});

export default router;
