import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { platformUsersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface AuthRequest extends Request {
  userId?: string;        // platform_users.id
  userRole?: "superadmin" | "artist" | "client";
  tenantId?: string;      // artists.id (for artist role)
  artistId?: string;      // alias for tenantId — backward compat
  artistEmail?: string;
  clerkUserId?: string;
  isSuperAdmin?: boolean;
}

/**
 * Resolves the Clerk session → platform_users record → sets req.userId, req.userRole, req.tenantId.
 * For artists: req.artistId = req.tenantId (backward compat with existing routes).
 * Returns 403 + needsOnboarding if no platform_users record found.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = getAuth(req);

  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Autenticação necessária" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.clerkUserId, auth.userId))

    if (!user) {
      res.status(403).json({
        error: "No profile",
        message: "Perfil não encontrado. Complete o cadastro.",
        needsOnboarding: true,
      });
      return;
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.clerkUserId = auth.userId;
    req.isSuperAdmin = user.role === "superadmin";

    // Backward compat: artistId = tenantId for artist/superadmin acting on tenant routes
    if (user.role === "artist" && user.tenantId) {
      req.artistId = user.tenantId;
      req.tenantId = user.tenantId;
    }

    // Set RLS session variable AFTER user is confirmed (defense-in-depth)
    try {
      
      await db.execute(
        sql`SET app.clerk_user_id = ${auth.userId}`
      );
      } catch {
      // Non-fatal: app-level checks are the primary isolation mechanism
    }

    next();
  } catch (err) {
    logger.error({ err }, "requireAuth DB lookup error");
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/** Only artists (or superadmin acting on a tenant) can access tenant routes. */
export const requireArtistRole = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.userRole !== "artist" && req.userRole !== "superadmin") {
    res.status(403).json({ error: "Forbidden", message: "Acesso restrito a artistas" });
    return;
  }
  if (req.userRole === "artist" && !req.tenantId) {
    res.status(403).json({
      error: "No tenant",
      message: "Perfil de artista não encontrado",
      needsOnboarding: true,
    });
    return;
  }
  next();
};

/** Only the superadmin can access admin routes. */
export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: "Forbidden", message: "Acesso restrito ao administrador da plataforma" });
    return;
  }
  next();
};
