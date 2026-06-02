import { pgTable, uuid, bigint, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistsTable } from "./artists";

// Saldos consolidados do artista (cache para consultas rápidas).
// A fonte da verdade financeira é wallet_transactions.
export const artistWalletsTable = pgTable("artist_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artistsTable.id, { onDelete: "cascade" })
    .unique(),
  availableBalance: bigint("available_balance", { mode: "number" }).notNull().default(0),   // centavos — pode sacar
  pendingBalance: bigint("pending_balance", { mode: "number" }).notNull().default(0),       // centavos — período de segurança
  totalEarned: bigint("total_earned", { mode: "number" }).notNull().default(0),             // centavos — acumulado histórico
  totalWithdrawn: bigint("total_withdrawn", { mode: "number" }).notNull().default(0),       // centavos — já sacado
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertArtistWalletSchema = createInsertSchema(artistWalletsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertArtistWallet = z.infer<typeof insertArtistWalletSchema>;
export type ArtistWallet = typeof artistWalletsTable.$inferSelect;