import { pgTable, uuid, bigint, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistWalletsTable } from "./artist_wallets";
import { ordersTable } from "./orders";

export const WALLET_TX_TYPES = ["CREDIT", "DEBIT", "WITHDRAWAL"] as const;
export type WalletTxType = (typeof WALLET_TX_TYPES)[number];

export const WALLET_TX_STATUSES = [
  "PENDING_SECURITY",   // dentro do período de segurança de 7 dias
  "AVAILABLE",          // pronto para saque
  "SETTLED",            // sacado/liquidado
] as const;
export type WalletTxStatus = (typeof WALLET_TX_STATUSES)[number];

// Fonte única da verdade financeira.
// artist_wallets é apenas cache de saldos consolidados.
export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => artistWalletsTable.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .references(() => ordersTable.id, { onDelete: "set null" }),
  type: text("type").$type<WalletTxType>().notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),       // centavos
  status: text("status").$type<WalletTxStatus>().notNull().default("PENDING_SECURITY"),
  availableAt: timestamp("available_at").notNull(),             // createdAt + 7 dias
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;