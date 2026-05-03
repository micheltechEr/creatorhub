import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { CreateCheckoutBody } from "@workspace/api-zod";
import { v4 as uuidv4 } from "uuid";
import {
  findOrCreateCustomer,
  createPayment,
  getPayment,
  getPixQrCode,
  mapAsaasStatus,
  dueDateString,
  type BillingType,
} from "../lib/asaas";
import { logger } from "../lib/logger";

const router = Router();

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? "";

const formatPayment = (p: typeof paymentsTable.$inferSelect) => ({
  id: p.id,
  orderId: p.orderId,
  amount: Number(p.amount),
  currency: p.currency,
  status: p.status,
  provider: p.provider,
  billingType: p.billingType,
  transactionId: p.transactionId,
  asaasPaymentId: p.asaasPaymentId,
  checkoutUrl: p.checkoutUrl,
  invoiceUrl: p.invoiceUrl,
  boletoUrl: p.boletoUrl,
  pixQrCode: p.pixQrCode,
  pixCopiaECola: p.pixCopiaECola,
  createdAt: p.createdAt,
});

// ── POST /payments/checkout ───────────────────────────────────────────────────
router.post("/payments/checkout", requireAuth, async (req: AuthRequest, res) => {
  const parse = CreateCheckoutBody.safeParse(req.body);
  if (!parse.success) {
    res
      .status(400)
      .json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const { orderId, billingType = "PIX", cpfCnpj } = parse.data as any;

  // Load order — must belong to the authenticated artist (OWASP A01)
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.id, orderId),
        eq(ordersTable.artistId, req.artistId!),
      ),
    )
    .limit(1);

  if (!order) {
    res
      .status(404)
      .json({ error: "Not found", message: "Pedido não encontrado" });
    return;
  }

  if (order.status !== "PROPOSED") {
    res.status(400).json({
      error: "Bad request",
      message: `Pedido já está em status ${order.status} — não é possível iniciar pagamento`,
    });
    return;
  }

  const amountBRL = Number(order.basePrice);
  const amountCents = Math.round(amountBRL * 100);

  let asaasPaymentId: string | null = null;
  let checkoutUrl: string | null = null;
  let invoiceUrl: string | null = null;
  let boletoUrl: string | null = null;
  let pixQrCode: string | null = null;
  let pixCopiaECola: string | null = null;
  let asaasCustomerId: string | null = null;

  try {
    const customer = await findOrCreateCustomer({
      name: order.clientName,
      email: order.clientEmail,
      cpfCnpj: cpfCnpj ?? order.clientCpfCnpj ?? undefined,
    });
    asaasCustomerId = customer.id;

    const payment = await createPayment({
      customer: customer.id,
      billingType: (billingType as BillingType) ?? "PIX",
      value: amountBRL,
      dueDate: dueDateString(3),
      description: `CREATOR HUB — ${order.title}`,
      externalReference: order.id,
    });

    asaasPaymentId = payment.id;
    invoiceUrl = payment.invoiceUrl ?? null;
    boletoUrl = payment.bankSlipUrl ?? null;
    checkoutUrl = payment.invoiceUrl ?? null;

    if ((billingType as string) === "PIX") {
      try {
        const qr = await getPixQrCode(payment.id);
        pixQrCode = qr.encodedImage;
        pixCopiaECola = qr.payload;
      } catch {
        // QR code may not be ready immediately — client can poll
      }
    }
  } catch (err: any) {
    req.log?.error({ err }, "Asaas API error");
    res.status(502).json({
      error: "Payment gateway error",
      message: "Erro ao criar pagamento no Asaas. Tente novamente.",
    });
    return;
  }

  const transactionId =
    asaasPaymentId ?? `local_${uuidv4().replace(/-/g, "")}`;

  const [dbPayment] = await db
    .insert(paymentsTable)
    .values({
      orderId,
      amount: amountCents,
      currency: "BRL",
      status: "PENDING",
      provider: "asaas",
      billingType,
      transactionId,
      asaasPaymentId,
      asaasCustomerId,
      checkoutUrl,
      invoiceUrl,
      boletoUrl,
      pixQrCode,
      pixCopiaECola,
    })
    .returning();

  await db
    .update(ordersTable)
    .set({ status: "PAYMENT_PENDING", updatedAt: new Date() })
    .where(eq(ordersTable.id, orderId));

  res.status(201).json({
    ...formatPayment(dbPayment),
    checkoutUrl,
    invoiceUrl,
    boletoUrl,
    pixQrCode,
    pixCopiaECola,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  });
});

// ── GET /payments/order/:orderId ─────────────────────────────────────────────
router.get(
  "/payments/order/:orderId",
  requireAuth,
  async (req: AuthRequest, res) => {
    // Verify the order belongs to this artist before returning payment (OWASP A01)
    const [order] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.id, req.params.orderId as string),
          eq(ordersTable.artistId, req.artistId!),
        ),
      )
      .limit(1);

    if (!order) {
      res
        .status(404)
        .json({ error: "Not found", message: "Pedido não encontrado" });
      return;
    }

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.orderId, req.params.orderId as string))
      .limit(1);

    if (!payment) {
      res
        .status(404)
        .json({ error: "Not found", message: "Pagamento não encontrado" });
      return;
    }

    // Sync status from Asaas in real-time when still pending
    if (payment.asaasPaymentId && payment.status === "PENDING") {
      try {
        const asaas = await getPayment(payment.asaasPaymentId);
        const newStatus = mapAsaasStatus(asaas.status);

        if (newStatus !== payment.status) {
          await db
            .update(paymentsTable)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(paymentsTable.id, payment.id));

          if (newStatus === "CONFIRMED") {
            await db
              .update(ordersTable)
              .set({ status: "PAID", updatedAt: new Date() })
              .where(eq(ordersTable.id, payment.orderId));
          }

          payment.status = newStatus;
        }
      } catch {
        // Return cached status if Asaas is unreachable
      }
    }

    res.json(formatPayment(payment));
  },
);

// ── GET /payments/:id/pix-qr ─────────────────────────────────────────────────
router.get(
  "/payments/:id/pix-qr",
  requireAuth,
  async (req: AuthRequest, res) => {
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, req.params.id as string))
      .limit(1);

    if (!payment || !payment.asaasPaymentId) {
      res
        .status(404)
        .json({ error: "Not found", message: "Pagamento não encontrado" });
      return;
    }

    // Ownership check: the order must belong to this artist (OWASP A01)
    const [order] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.id, payment.orderId),
          eq(ordersTable.artistId, req.artistId!),
        ),
      )
      .limit(1);

    if (!order) {
      res
        .status(403)
        .json({ error: "Forbidden", message: "Sem permissão para este pagamento" });
      return;
    }

    try {
      const qr = await getPixQrCode(payment.asaasPaymentId);

      await db
        .update(paymentsTable)
        .set({
          pixQrCode: qr.encodedImage,
          pixCopiaECola: qr.payload,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, payment.id));

      res.json({
        pixQrCode: qr.encodedImage,
        pixCopiaECola: qr.payload,
        expirationDate: qr.expirationDate,
      });
    } catch {
      res
        .status(502)
        .json({ error: "Gateway error", message: "Erro ao buscar QR Code PIX" });
    }
  },
);

// ── POST /payments/webhook — Asaas webhook (OWASP A08 integrity) ─────────────
// Register in Asaas dashboard: POST https://your-domain/api/payments/webhook
// Set a strong token in ASAAS_WEBHOOK_TOKEN and configure it in Asaas dashboard.
router.post("/payments/webhook", async (req, res) => {
  // Validate webhook token if configured (OWASP A08)
  if (ASAAS_WEBHOOK_TOKEN) {
    const provided =
      req.headers["asaas-access-token"] ??
      req.headers["x-webhook-token"] ??
      "";
    if (provided !== ASAAS_WEBHOOK_TOKEN) {
      logger.warn({ ip: req.ip }, "Webhook request with invalid token");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  // Acknowledge immediately so Asaas doesn't retry
  res.json({ received: true });

  const event = req.body as {
    event: string;
    payment?: {
      id: string;
      status: string;
      externalReference: string;
      value: number;
      billingType: string;
    };
  };

  if (!event.payment) return;

  const {
    id: asaasPaymentId,
    status: asaasStatus,
  } = event.payment;

  const internalStatus = mapAsaasStatus(asaasStatus);

  try {
    const [updated] = await db
      .update(paymentsTable)
      .set({ status: internalStatus, updatedAt: new Date() })
      .where(eq(paymentsTable.asaasPaymentId, asaasPaymentId))
      .returning();

    if (!updated) return;

    if (internalStatus === "CONFIRMED") {
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, updated.orderId))
        .limit(1);

      if (order && order.status === "PAYMENT_PENDING") {
        await db
          .update(ordersTable)
          .set({ status: "PAID", updatedAt: new Date() })
          .where(eq(ordersTable.id, updated.orderId));
      }
    }
  } catch (err) {
    logger.error({ err }, "Webhook processing error");
  }
});

export default router;
