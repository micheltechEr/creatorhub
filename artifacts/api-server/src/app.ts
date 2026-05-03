import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { existsSync } from "fs";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalLimiter } from "./lib/rate-limiters";

const app: Express = express();

// ── Trust proxy (Replit / nginx sits in front) ───────────────────────────────
app.set("trust proxy", 1);

// ── Security headers (OWASP A05) ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// ── CORS — restrict to known origins (OWASP A05) ─────────────────────────────
const rawOrigins = process.env.ALLOWED_ORIGINS ?? "";
const ALLOWED_ORIGINS: string[] = rawOrigins
  ? rawOrigins.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server / curl in dev)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Global rate limiter: 300 req / 15 min per IP (OWASP A04) ─────────────────
app.use(globalLimiter);

// ── Request logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Body parsing with size limits (OWASP A05) ────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

// ── Production: serve compiled frontend ──────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(process.cwd(), "public");
  if (existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }
}

export default app;
