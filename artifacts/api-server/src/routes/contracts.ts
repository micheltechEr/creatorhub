import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { contractsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireArtistRole, AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

// ── File upload for contract PDFs ─────────────────────────────────────────────
const contractsDir = path.resolve(process.cwd(), "uploads/contracts");
if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });

const ALLOWED_CONTRACT_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

const contractUpload = multer({
  storage: multer.diskStorage({
    destination: contractsDir,
    filename: (_req, _file, cb) => {
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ALLOWED_CONTRACT_TYPES[file.mimetype];
    if (!allowed) return cb(new Error("Tipo não suportado. Aceitos: PDF, DOC, DOCX"));
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Extensão não corresponde ao tipo"));
    cb(null, true);
  },
});

// Validation schemas
const CreateContractBody = z.object({
  title: z.string().min(1).max(255),
  contentHtml: z.string().default(""),
  status: z.enum(["draft", "finalized"]).default("draft"),
});

const UpdateContractBody = z.object({
  title: z.string().min(1).max(255).optional(),
  contentHtml: z.string().optional(),
  status: z.enum(["draft", "finalized"]).optional(),
});

const formatContract = (c: typeof contractsTable.$inferSelect) => ({
  id: c.id,
  tenantId: c.tenantId,
  title: c.title,
  contentHtml: c.contentHtml,
  fileUrl: c.fileUrl,
  fileName: c.fileName,
  type: c.type,
  status: c.status,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

// ── GET /contracts — list ─────────────────────────────────────────────────────
router.get("/contracts", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const contracts = await db
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.tenantId, req.tenantId!))
    .orderBy(sql`${contractsTable.updatedAt} DESC`);

  res.json({ contracts: contracts.map(formatContract) });
});

// ── GET /contracts/:id ────────────────────────────────────────────────────────
router.get("/contracts/:id", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const [contract] = await db
    .select()
    .from(contractsTable)
    .where(and(eq(contractsTable.id, req.params.id), eq(contractsTable.tenantId, req.tenantId!)))
    .limit(1);

  if (!contract) {
    res.status(404).json({ error: "Not found", message: "Contrato não encontrado" });
    return;
  }

  res.json(formatContract(contract));
});

// ── POST /contracts — create HTML contract ────────────────────────────────────
router.post("/contracts", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const parse = CreateContractBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const [contract] = await db
    .insert(contractsTable)
    .values({
      tenantId: req.tenantId!,
      title: parse.data.title,
      contentHtml: parse.data.contentHtml,
      type: "created",
      status: parse.data.status,
    })
    .returning();

  res.status(201).json(formatContract(contract));
});

// ── PUT /contracts/:id — update HTML content ──────────────────────────────────
router.put("/contracts/:id", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const parse = UpdateContractBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const updates: Partial<typeof contractsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parse.data.title !== undefined) updates.title = parse.data.title;
  if (parse.data.contentHtml !== undefined) updates.contentHtml = parse.data.contentHtml;
  if (parse.data.status !== undefined) updates.status = parse.data.status;

  const [contract] = await db
    .update(contractsTable)
    .set(updates)
    .where(and(eq(contractsTable.id, req.params.id), eq(contractsTable.tenantId, req.tenantId!)))
    .returning();

  if (!contract) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(formatContract(contract));
});

// ── DELETE /contracts/:id ─────────────────────────────────────────────────────
router.delete("/contracts/:id", requireAuth, requireArtistRole, async (req: AuthRequest, res) => {
  const [existing] = await db
    .select()
    .from(contractsTable)
    .where(and(eq(contractsTable.id, req.params.id), eq(contractsTable.tenantId, req.tenantId!)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Clean up uploaded file if exists
  if (existing.fileUrl) {
    const filename = path.basename(existing.fileUrl.split("/").pop() ?? "");
    const filePath = path.resolve(contractsDir, filename);
    if (filePath.startsWith(contractsDir) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await db.delete(contractsTable).where(eq(contractsTable.id, req.params.id));
  res.json({ message: "Contrato removido", id: req.params.id });
});

// ── POST /contracts/upload — upload PDF/DOC ───────────────────────────────────
router.post(
  "/contracts/upload",
  requireAuth,
  requireArtistRole,
  contractUpload.single("file"),
  async (req: AuthRequest, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file", message: "Nenhum arquivo enviado" });
      return;
    }

    const title = (req.body?.title as string) || path.basename(file.originalname, path.extname(file.originalname));
    const fileUrl = `/api/contracts/file/${file.filename}`;

    const [contract] = await db
      .insert(contractsTable)
      .values({
        tenantId: req.tenantId!,
        title: title.slice(0, 255),
        contentHtml: "",
        fileUrl,
        fileName: path.basename(file.originalname).slice(0, 255),
        type: "uploaded",
        status: "draft",
      })
      .returning();

    res.status(201).json(formatContract(contract));
  },
);

// ── GET /contracts/file/:filename — serve uploaded contract files ──────────────
router.get("/contracts/file/:filename", requireAuth, (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  if (!/^[\w.-]+$/.test(safeFilename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filePath = path.resolve(contractsDir, safeFilename);
  if (!filePath.startsWith(contractsDir + path.sep) && filePath !== contractsDir) {
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
