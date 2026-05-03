import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  artistId?: string;
  artistEmail?: string;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing token" });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET || "dev-jwt-secret";

  try {
    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };
    req.artistId = decoded.id;
    req.artistEmail = decoded.email;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
  }
};
