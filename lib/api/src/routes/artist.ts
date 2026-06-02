// Use CommonJS require to avoid missing type declarations for express
const express = require('express');
const router = express.Router();
// Types are loosely defined as any to keep compilation simple
type Request = any;
type Response = any;
import { AsaasService, AsaasProvider } from "../services/asaasService";
// Import db instance (relative path from this file to lib/db/src/index.ts)
import { db } from "../../../db/src";

// Instancia o serviço (poderia ser injetado via DI)
const asaasService = new AsaasService(new AsaasProvider());

// POST /artists/:id/connect-asaas
router.post("/:id/connect-asaas", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await asaasService.connectArtist(id);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
