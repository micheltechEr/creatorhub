import { pgTable, uuid, bigint, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistWalletsTable } from "./artist_wallets";
import { artistsTable } from "./artists";

export const WITHDRAWAL_STATUSES = [
  "PENDING",      // Solicitado, aguardando processamento
  "PROCESSING",   // Enviado ao Asaas
  "COMPLETED",    // Transferência confirmada
  "FAILED",       // Falhou no Asaas
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

// Solicitações de saque do artista
export const withdrawalRequestsTable = pgTable("withdrawal_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => artistWalletsTable.id, { onDelete: "cascade" }),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artistsTable.id, { onDelete: "cascade" }),
  amount: bigint("amount", { mode: "number" }).notNull(),   // centavos
  status: text("status").$type<WithdrawalStatus>().notNull().default("PENDING"),
  asaasTransferId: text("asaas_transfer_id"),               // ID da transferência no Asaas
  failureReason: text("failure_reason"),                     // Motivo em caso de FAILED
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type WithdrawalRequest = typeof withdrawalRequestsTable.$inferSelect;