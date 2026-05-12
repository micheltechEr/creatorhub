import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { mediaTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, AuthRequest, requireArtistRole } from "../middlewares/auth";

const router = Router();

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

// Strict whitelist: allowed MIME types AND their valid extensions (OWASP A08)
const ALLOWED: Record<string, string[]> = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/x-msvideo": [".avi"],
};

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, _file, cb) => {
    // Use only a UUID-style name — never trust the original filename
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowedExts = ALLOWED[file.mimetype];
    if (!allowedExts) {
      return cb(new Error("Tipo de arquivo não suportado. Aceitos: MP4, MOV, AVI"));
    }
    // Also validate declared extension (OWASP A08)
    const declaredExt = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(declaredExt)) {
      return cb(new Error("Extensão de arquivo não corresponde ao tipo declarado"));
    }
    cb(null, true);
  },
});

// ── GET /media — list my media ───────────────────────────────────────────────
router.get("/media", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const [media, countResult] = await Promise.all([
    db
      .select()
      .from(mediaTable)
      .where(eq(mediaTable.artistId, req.artistId!))
      .orderBy(sql`${mediaTable.uploadedAt} DESC`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mediaTable)
      .where(eq(mediaTable.artistId, req.artistId!)),
  ]);

  res.json({
    media: media.map((m) => ({
      id: m.id,
      artistId: m.artistId,
      fileName: m.fileName,
      fileSize: Number(m.fileSize),
      fileUrl: m.fileUrl,
      mimeType: m.mimeType,
      uploadedAt: m.uploadedAt,
    })),
    total: Number(countResult[0]?.count ?? 0),
  });
});

// ── POST /media — upload a video ─────────────────────────────────────────────
router.post(
  "/media",
  requireAuth,
  requireArtistRole,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    const file = req.file;
    if (!file) {
      res
        .status(400)
        .json({ error: "No file", message: "Nenhum arquivo enviado" });
      return;
    }

    const fileUrl = `/api/media/file/${file.filename}`;

    const [media] = await db
      .insert(mediaTable)
      .values({
        artistId: req.artistId!,
        fileName: path.basename(file.originalname).slice(0, 255),
        fileSize: file.size,
        fileUrl,
        mimeType: file.mimetype,
      })
      .returning();

    res.status(201).json({
      id: media.id,
      artistId: media.artistId,
      fileName: media.fileName,
      fileSize: Number(media.fileSize),
      fileUrl: media.fileUrl,
      mimeType: media.mimeType,
      uploadedAt: media.uploadedAt,
    });
  },
);

// ── DELETE /media/:id — delete my media (OWASP A01: ownership check) ─────────
router.delete("/media/:id", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const [media] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, req.params.id as string))
    .limit(1);

  if (!media) {
    res
      .status(404)
      .json({ error: "Not found", message: "Arquivo não encontrado" });
    return;
  }

  // Ownership check (OWASP A01)
  if (media.artistId !== req.artistId) {
    res
      .status(403)
      .json({ error: "Forbidden", message: "Sem permissão para remover este arquivo" });
    return;
  }

  // Safe filename extraction — never trust file.fileUrl blindly
  const rawFilename = media.fileUrl.split("/").pop() ?? "";
  const safeFilename = path.basename(rawFilename);
  const filePath = path.resolve(uploadDir, safeFilename);

  // Prevent path traversal
  if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await db.delete(mediaTable).where(eq(mediaTable.id, req.params.id as string));
  res.json({ message: "Arquivo removido com sucesso" });
});

// ── GET /artists/:artistId/media — public portfolio ──────────────────────────
router.get("/artists/:artistId/media", async (req, res) => {
  const { artistId } = req.params;
  const [media, countResult] = await Promise.all([
    db
      .select()
      .from(mediaTable)
      .where(eq(mediaTable.artistId, artistId as string))
      .orderBy(sql`${mediaTable.uploadedAt} DESC`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mediaTable)
      .where(eq(mediaTable.artistId, artistId as string)),
  ]);

  res.json({
    media: media.map((m) => ({
      id: m.id,
      artistId: m.artistId,
      fileName: m.fileName,
      fileSize: Number(m.fileSize),
      fileUrl: m.fileUrl,
      mimeType: m.mimeType,
      uploadedAt: m.uploadedAt,
    })),
    total: Number(countResult[0]?.count ?? 0),
  });
});

// ── GET /media/file/:filename — serve uploaded files (OWASP A08 path traversal) ──
router.get("/media/file/:filename", (req, res) => {
  // Strip any directory components to prevent path traversal
  const safeFilename = path.basename(req.params.filename);

  // Extra guard: only allow the safe characters we generate in storage.filename
  if (!/^[\w.-]+$/.test(safeFilename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filePath = path.resolve(uploadDir, safeFilename);

  // Ensure resolved path is still inside uploadDir
  if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.sendFile(filePath);
});

export default router;
