import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { artistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface AuthRequest extends Request {
  artistId?: string;
  artistEmail?: string;
  clerkUserId?: string;
}

/**
 * Verifies the Clerk session and resolves the artist profile from the DB.
 * Returns 401 if not authenticated, 403 (needsOnboarding) if no artist profile exists.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = getAuth(req);

  if (!auth.userId) {
    res
      .status(401)
      .json({ error: "Unauthorized", message: "Autenticação necessária" });
    return;
  }

  try {
    const [artist] = await db
      .select()
      .from(artistsTable)
      .where(eq(artistsTable.clerkUserId, auth.userId))
      .limit(1);

    if (!artist) {
      res.status(403).json({
        error: "No profile",
        message: "Perfil de artista não encontrado. Complete o cadastro.",
        needsOnboarding: true,
      });
      return;
    }

    req.artistId = artist.id;
    req.artistEmail = artist.email;
    req.clerkUserId = auth.userId;
    next();
  } catch (err) {
    logger.error({ err }, "requireAuth DB lookup error");
    res.status(500).json({ error: "Internal Server Error" });
  }
};
