import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { artistsTable } from "./artists";

export const up = sql`
  CREATE TABLE asaas_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES ${artistsTable.name}(id) ON DELETE CASCADE,
    asaas_customer_id TEXT NOT NULL UNIQUE,
    wallet_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
`;

export const down = sql`
  DROP TABLE IF EXISTS asaas_accounts;
`;
