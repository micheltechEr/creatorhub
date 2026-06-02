import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistsTable } from "./artists";

export const PIX_KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

// Chave PIX permanente do artista para saques
export const artistPayoutSettingsTable = pgTable("artist_payout_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artistsTable.id, { onDelete: "cascade" })
    .unique(),
  pixKey: text("pix_key").notNull(),
  pixKeyType: text("pix_key_type").$type<PixKeyType>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertArtistPayoutSettingsSchema = createInsertSchema(artistPayoutSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertArtistPayoutSettings = z.infer<typeof insertArtistPayoutSettingsSchema>;
export type ArtistPayoutSettings = typeof artistPayoutSettingsTable.$inferSelect;