import { pgTable, text, decimal, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistsTable } from "./artists";

export const ORDER_STATUSES = [
  "PROPOSED",
  "PAYMENT_PENDING",
  "PAID",
  "IN_PROGRESS",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artistsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  occasion: text("occasion"),
  names: text("names").array().notNull().default([]),
  referenceLinks: text("reference_links").array().notNull().default([]),
  deadline: timestamp("deadline").notNull(),
  additionalInstructions: text("additional_instructions"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").$type<OrderStatus>().notNull().default("PROPOSED"),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientCpfCnpj: text("client_cpf_cnpj"),   // CPF or CNPJ — required for Asaas payments
  deliveryVideoUrl: text("delivery_video_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
