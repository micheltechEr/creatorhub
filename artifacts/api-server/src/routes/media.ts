import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { mediaTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIMES = ["video/mp4", "video/quicktime", "video/x-msvideo"];

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não suportado. Aceitos: MP4, MOV, AVI"));
    }
  },
});

router.get("/media", requireAuth, async (req: AuthRequest, res) => {
  const [media, countResult] = await Promise.all([
    db.select().from(mediaTable).where(eq(mediaTable.artistId, req.artistId!)).orderBy(sql`${mediaTable.uploadedAt} DESC`),
    db.select({ count: sql<number>`count(*)` }).from(mediaTable).where(eq(mediaTable.artistId, req.artistId!)),
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

router.post("/media", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file", message: "Nenhum arquivo enviado" });
    return;
  }

  const fileUrl = `/api/media/file/${req.file.filename}`;

  const [media] = await db.insert(mediaTable).values({
    artistId: req.artistId!,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    fileUrl,
    mimeType: req.file.mimetype,
  }).returning();

  res.status(201).json({
    id: media.id,
    artistId: media.artistId,
    fileName: media.fileName,
    fileSize: Number(media.fileSize),
    fileUrl: media.fileUrl,
    mimeType: media.mimeType,
    uploadedAt: media.uploadedAt,
  });
});

router.delete("/media/:id", requireAuth, async (req: AuthRequest, res) => {
  const [media] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, req.params.id as string))
    .limit(1);

  if (!media) {
    res.status(404).json({ error: "Not found", message: "Arquivo não encontrado" });
    return;
  }

  const filename = media.fileUrl.split("/").pop();
  if (filename) {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await db.delete(mediaTable).where(eq(mediaTable.id, req.params.id as string));
  res.json({ message: "Arquivo removido com sucesso" });
});

// Serve uploaded files
router.get("/media/file/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
