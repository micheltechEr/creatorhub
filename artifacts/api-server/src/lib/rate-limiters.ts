import rateLimit from "express-rate-limit";

/**
 * Global rate limiter: 300 requests / 15 minutes per IP.
 * Applied to all routes except /api/health.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    message: "Muitas requisições. Tente novamente mais tarde.",
  },
  skip: (req) => req.path === "/api/health",
});

/**
 * Strict limiter for auth endpoints: 10 requests / 15 minutes per IP.
 * Returns a redirectTo field so clients can send the user to the home page.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    message: "Muitas tentativas. Acesso bloqueado temporariamente.",
    redirectTo: "/",
  },
});

/**
 * Limiter for public order creation: 20 requests / hour per IP.
 */
export const orderCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    message: "Muitos pedidos criados. Tente novamente mais tarde.",
  },
});

/**
 * Limiter for public review creation: 10 requests / hour per IP.
 */
export const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    message: "Muitas avaliações em pouco tempo. Tente mais tarde.",
  },
});
