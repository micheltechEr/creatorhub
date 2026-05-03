import { pgTable, text, bigint, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  amount: bigint("amount", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("BRL"),
  status: text("status").notNull().default("PENDING"),
  provider: text("provider").notNull(),
  transactionId: text("transaction_id").notNull().unique(),

  // Asaas-specific fields
  billingType: text("billing_type"),          // PIX | BOLETO | CREDIT_CARD | UNDEFINED
  asaasPaymentId: text("asaas_payment_id"),   // Asaas internal ID (pay_xxxx)
  asaasCustomerId: text("asaas_customer_id"), // Asaas customer ID (cus_xxxx)
  checkoutUrl: text("checkout_url"),          // Asaas hosted payment page
  invoiceUrl: text("invoice_url"),            // Asaas invoice URL
  boletoUrl: text("boleto_url"),              // Boleto PDF URL
  pixQrCode: text("pix_qr_code"),            // Base64 QR code image
  pixCopiaECola: text("pix_copia_e_cola"),   // PIX copy-and-paste key

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
