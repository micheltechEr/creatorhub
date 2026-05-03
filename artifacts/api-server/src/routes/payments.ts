import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { CreateCheckoutBody, ConfirmPaymentBody } from "@workspace/api-zod";
import { v4 as uuidv4 } from "uuid";

const router = Router();

const formatPayment = (p: typeof paymentsTable.$inferSelect) => ({
  id: p.id,
  orderId: p.orderId,
  amount: Number(p.amount),
  currency: p.currency,
  status: p.status,
  provider: p.provider,
  transactionId: p.transactionId,
  createdAt: p.createdAt,
});

router.post("/payments/checkout", requireAuth, async (req: AuthRequest, res) => {
  const parse = CreateCheckoutBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const { orderId, provider = "stripe" } = parse.data;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.artistId, req.artistId!)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Not found", message: "Pedido não encontrado" });
    return;
  }

  const sessionId = `sess_${uuidv4().replace(/-/g, "")}`;
  const amount = Math.ceil(Number(order.basePrice) * 100 * 1.05);

  await db.insert(paymentsTable).values({
    orderId,
    amount,
    currency: "BRL",
    status: "PENDING",
    provider: provider ?? "stripe",
    transactionId: sessionId,
  });

  await db.update(ordersTable).set({ status: "PAYMENT_PENDING", updatedAt: new Date() }).where(eq(ordersTable.id, orderId));

  res.json({
    checkoutUrl: `https://checkout.stripe.com/pay/${sessionId}`,
    sessionId,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
});

router.post("/payments/confirm", requireAuth, async (req: AuthRequest, res) => {
  const parse = ConfirmPaymentBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation error", message: parse.error.message });
    return;
  }

  const { sessionId, provider } = parse.data;

  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.transactionId, sessionId))
    .limit(1);

  if (!payment) {
    res.status(404).json({ error: "Not found", message: "Pagamento não encontrado" });
    return;
  }

  const [updatedPayment] = await db
    .update(paymentsTable)
    .set({ status: "CONFIRMED", updatedAt: new Date() })
    .where(eq(paymentsTable.id, payment.id))
    .returning();

  await db.update(ordersTable).set({ status: "PAID", updatedAt: new Date() }).where(eq(ordersTable.id, payment.orderId));

  res.json(formatPayment(updatedPayment));
});

router.get("/payments/order/:orderId", requireAuth, async (req: AuthRequest, res) => {
  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.orderId, req.params.orderId))
    .limit(1);

  if (!payment) {
    res.status(404).json({ error: "Not found", message: "Pagamento não encontrado" });
    return;
  }

  res.json(formatPayment(payment));
});

export default router;
