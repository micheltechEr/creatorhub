import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Idempotência: registra webhooks já processados para evitar crédito duplicado
export const asaasEventsTable = pgTable("asaas_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: text("event_id").notNull().unique(),   // ID do evento Asaas (evt_xxxx)
  eventType: text("event_type").notNull(),         // PAYMENT_RECEIVED, TRANSFER_*, etc.
  payload: jsonb("payload"),                       // Body bruto do webhook
  processedAt: timestamp("processed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAsaasEventSchema = createInsertSchema(asaasEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAsaasEvent = z.infer<typeof insertAsaasEventSchema>;
export type AsaasEvent = typeof asaasEventsTable.$inferSelect;