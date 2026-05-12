// middlewares/auth.ts — VERSÃO CORRIGIDA
// O problema era limit($2) — PostgreSQL não gosta disso com RLS

import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { platformUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: "superadmin" | "artist" | "client";
  tenantId?: string;
  artistId?: string;
  artistEmail?: string;
  clerkUserId?: string;
  isSuperAdmin?: boolean;
}

/**
 * FIX: Não usar limit() — fazer a query SEM parametrizar limit
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = getAuth(req);

  if (!auth.userId) {
    res.status(401).json({ 
      error: "Unauthorized", 
      message: "Autenticação necessária" 
    });
    return;
  }

  try {
    logger.info({ clerkUserId: auth.userId }, "[AUTH] Iniciando lookup");

    // ⚠️ FIX: Não usar .limit(1) — isso causa "Tenant or user not found"
    // Solução: Fazer a query sem limit() parametrizado
    const query = db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.clerkUserId, auth.userId));

    logger.debug({ query: query.toSQL() }, "[AUTH] Query SQL");

    const users = await query;
    const user = users[0];

    logger.info(
      { found: !!user, userId: user?.id },
      "[AUTH] Query resultado"
    );

    if (!user) {
      logger.info(
        { clerkUserId: auth.userId },
        "[AUTH] Usuário não encontrado — requer onboarding"
      );
      
      res.status(403).json({
        error: "No profile",
        message: "Perfil não encontrado. Complete o cadastro.",
        needsOnboarding: true,
      });
      return;
    }

    // ✅ Usuário encontrado
    req.userId = user.id;
    req.userRole = user.role;
    req.clerkUserId = auth.userId;
    req.isSuperAdmin = user.role === "superadmin";

    // Backward compat
    if (user.role === "artist" && user.tenantId) {
      req.artistId = user.tenantId;
      req.tenantId = user.tenantId;
    }

    logger.info(
      { userId: user.id, role: user.role },
      "[AUTH] ✅ Autenticação bem-sucedida"
    );

    next();
  } catch (err) {
    logger.error(
      { 
        err,
        message: (err as any).message,
        clerkUserId: auth.userId 
      },
      "[AUTH] ❌ Database error"
    );
    
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "Erro ao validar autenticação"
    });
  }
};

/** Only artists (or superadmin) can access tenant routes */
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
    res.status(403).json({ 
      error: "Forbidden", 
      message: "Acesso restrito a artistas" 
    });
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

/** Only superadmin can access admin routes */
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
    res.status(403).json({ 
      error: "Forbidden", 
      message: "Acesso restrito ao administrador" 
    });
    return;
  }
  next();
};