import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { artistsTable } from "./artists";

export const USER_ROLES = ["superadmin", "artist", "client"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * All authenticated platform users. Linked to Clerk for identity.
 * - superadmin: platform owner, sees all data
 * - artist: tenant owner, sees only their own workspace
 * - client: (future) linked to tenant_clients records
 */
export const platformUsersTable = pgTable("platform_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique().notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").$type<UserRole>().notNull().default("client"),
  // For artist role: references artists.id (the tenant profile/workspace)
  tenantId: uuid("tenant_id").references(() => artistsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PlatformUser = typeof platformUsersTable.$inferSelect;
