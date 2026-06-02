import { Router, type Request, type Response } from "express";
import { asaasService, MIN_WITHDRAWAL_CENTS } from "../services/asaasService";
import { PIX_KEY_TYPES } from "@workspace/db/schema";
import crypto from "crypto";

const router = Router();

// ── Webhook do Asaas (sem auth — validado por assinatura HMAC) ────────────────
router.post("/webhooks/asaas", async (req: Request, res: Response) => {
  try {
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (webhookToken) {
      const signature = req.headers["asaas-signature"] as string | undefined;
      if (!signature) {
        res.status(401).json({ error: "Missing asaas-signature header" });
        return;
      }

      // Verificar assinatura HMAC SHA-256
      const rawBody = JSON.stringify(req.body);
      const expected = crypto
        .createHmac("sha256", webhookToken)
        .update(rawBody)
        .digest("hex");

      if (signature !== expected) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }

    const event = req.body;
    const result = await asaasService.handleWebhook(event);

    res.status(200).json(result);
  } catch (err: any) {
    console.error("[Webhook Asaas] Error:", err);
    res.status(500).json({ error: "Internal webhook error" });
  }
});

// ── Middleware: exigir Clerk auth (aplicado nas rotas abaixo) ─────────────────
// Assumindo que o middleware de auth já está aplicado globalmente
// ou que a aplicação injeta req.auth?.userId via Clerk

function getArtistId(req: Request): string | null {
  // O middleware Clerk tipicamente popula req.auth.userId
  // Como fallback, tenta extrair do header ou session
  const userId = (req as any).auth?.userId ?? (req as any).userId ?? null;
  return userId;
}

// ── GET /wallet — Saldo do artista ───────────────────────────────────────────
router.get("/wallet", async (req: Request, res: Response) => {
  try {
    const artistId = getArtistId(req);
    if (!artistId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const wallet = await asaasService.getWallet(artistId);
    res.json({
      availableBalance: wallet.availableBalance,
      pendingBalance: wallet.pendingBalance,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
    });
  } catch (err: any) {
    console.error("[GET /wallet]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /wallet/transactions — Histórico de transações ───────────────────────
router.get("/wallet/transactions", async (req: Request, res: Response) => {
  try {
    const artistId = getArtistId(req);
    if (!artistId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { wallet, transactions } = await asaasService.getTransactions(artistId, limit, offset);
    res.json({ wallet, transactions, limit, offset });
  } catch (err: any) {
    console.error("[GET /wallet/transactions]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /wallet/payout-settings — Configurações de saque ─────────────────────
router.get("/wallet/payout-settings", async (req: Request, res: Response) => {
  try {
    const artistId = getArtistId(req);
    if (!artistId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const settings = await asaasService.getPayoutSettings(artistId);
    if (!settings) {
      res.json({ configured: false });
      return;
    }

    res.json({
      configured: true,
      pixKeyType: settings.pixKeyType,
      // Mascarar chave PIX por segurança (mostrar só últimos 4 chars)
      pixKeyMasked: maskPixKey(settings.pixKey, settings.pixKeyType),
    });
  } catch (err: any) {
    console.error("[GET /wallet/payout-settings]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /wallet/payout-settings — Atualizar configurações de saque ───────────
router.put("/wallet/payout-settings", async (req: Request, res: Response) => {
  try {
    const artistId = getArtistId(req);
    if (!artistId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { pixKey, pixKeyType } = req.body;

    if (!pixKey || !pixKeyType) {
      res.status(400).json({ error: "pixKey e pixKeyType são obrigatórios" });
      return;
    }

    if (!PIX_KEY_TYPES.includes(pixKeyType)) {
      res.status(400).json({
        error: `pixKeyType inválido. Valores aceitos: ${PIX_KEY_TYPES.join(", ")}`,
      });
      return;
    }

    // Validação básica da chave PIX
    if (pixKeyType === "CPF" && !/^\d{11}$/.test(pixKey)) {
      res.status(400).json({ error: "CPF deve ter 11 dígitos numéricos" });
      return;
    }
    if (pixKeyType === "CNPJ" && !/^\d{14}$/.test(pixKey)) {
      res.status(400).json({ error: "CNPJ deve ter 14 dígitos numéricos" });
      return;
    }
    if (pixKeyType === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)) {
      res.status(400).json({ error: "Email inválido" });
      return;
    }

    const settings = await asaasService.updatePayoutSettings(artistId, pixKey, pixKeyType);
    res.json({
      configured: true,
      pixKeyType: settings.pixKeyType,
      pixKeyMasked: maskPixKey(settings.pixKey, settings.pixKeyType),
    });
  } catch (err: any) {
    console.error("[PUT /wallet/payout-settings]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /wallet/withdraw — Solicitar saque ──────────────────────────────────
router.post("/wallet/withdraw", async (req: Request, res: Response) => {
  try {
    const artistId = getArtistId(req);
    if (!artistId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { amount } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ error: "amount (em centavos) é obrigatório e deve ser positivo" });
      return;
    }

    if (!Number.isInteger(amount)) {
      res.status(400).json({ error: "amount deve ser um número inteiro (centavos)" });
      return;
    }

    if (amount < MIN_WITHDRAWAL_CENTS) {
      res.status(400).json({
        error: `Valor mínimo para saque: R$ ${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2)}`,
      });
      return;
    }

    const result = await asaasService.requestWithdrawal(artistId, amount);
    res.json(result);
  } catch (err: any) {
    console.error("[POST /wallet/withdraw]", err);
    const status = err.message.includes("Saldo insuficiente") ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── GET /wallet/withdrawals — Histórico de saques ────────────────────────────
router.get("/wallet/withdrawals", async (req: Request, res: Response) => {
  try {
    const artistId = getArtistId(req);
    if (!artistId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const withdrawals = await asaasService.getWithdrawals(artistId);
    res.json(withdrawals);
  } catch (err: any) {
    console.error("[GET /wallet/withdrawals]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /wallet/process-pending — Job: liberar saldos do período de segurança ──
router.post("/wallet/process-pending", async (req: Request, res: Response) => {
  try {
    // TODO: Proteger com auth de admin ou API key interna
    const result = await asaasService.processPendingTransactions();
    res.json(result);
  } catch (err: any) {
    console.error("[POST /wallet/process-pending]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function maskPixKey(key: string, type: string): string {
  if (type === "CPF" || type === "CNPJ") {
    return "****" + key.slice(-4);
  }
  if (type === "EMAIL") {
    const [user, domain] = key.split("@");
    return user.slice(0, 2) + "****@" + domain;
  }
  if (type === "PHONE") {
    return "****" + key.slice(-4);
  }
  // EVP — mascarar completamente
  return "****-****-****";
}

export default router;