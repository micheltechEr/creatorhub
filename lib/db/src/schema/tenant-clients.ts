import { pgTable, text, uuid, timestamp, integer, decimal } from "drizzle-orm/pg-core";
import { artistsTable } from "./artists";

/**
 * CRM table — clients managed by each artist tenant.
 * Clients don't need platform accounts; they're tracked as data entities.
 * Auto-populated from orders; can also be created manually by artists.
 */
export const tenantClientsTable = pgTable("tenant_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => artistsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  notes: text("notes"),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TenantClient = typeof tenantClientsTable.$inferSelect;
