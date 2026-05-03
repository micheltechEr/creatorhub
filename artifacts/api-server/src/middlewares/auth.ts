import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

export interface AuthRequest extends Request {
  artistId?: string;
  artistEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret";

if (!process.env.JWT_SECRET) {
  logger.warn(
    "JWT_SECRET is not set — using insecure dev default. Set it in production!",
  );
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Unauthorized", message: "Token de autenticação ausente" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as { id: string; email: string; role: string };

    if (decoded.role !== "artist") {
      res.status(403).json({ error: "Forbidden", message: "Acesso negado" });
      return;
    }

    req.artistId = decoded.id;
    req.artistEmail = decoded.email;
    next();
  } catch (err) {
    res
      .status(401)
      .json({ error: "Unauthorized", message: "Token inválido ou expirado" });
  }
};
