
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistsTable } from "./artists";

// Tabela que relaciona artista à conta Asaas e ao walletId da plataforma
export const asaasAccountsTable = pgTable("asaas_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artistsTable.id, { onDelete: "cascade" }),
  asaasCustomerId: text("asaas_customer_id").notNull().unique(),
  walletId: text("wallet_id").notNull().unique(),
  status: text("status").notNull().default("PENDING"), // PENDING, ACTIVE, REJECTED
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAsaasAccountSchema = createInsertSchema(asaasAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAsaasAccount = z.infer<typeof insertAsaasAccountSchema>;
export type AsaasAccount = typeof asaasAccountsTable.$inferSelect;
