import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { artistsTable } from "./artists";

export const CONTRACT_TYPES = ["created", "uploaded"] as const;
export const CONTRACT_STATUSES = ["draft", "finalized"] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * Contracts per artist tenant.
 * type='created'  → content stored as HTML in content_html
 * type='uploaded' → file stored at file_url, content_html empty
 */
export const contractsTable = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => artistsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  contentHtml: text("content_html").notNull().default(""),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  type: text("type").$type<ContractType>().notNull().default("created"),
  status: text("status").$type<ContractStatus>().notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Contract = typeof contractsTable.$inferSelect;
