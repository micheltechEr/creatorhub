import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query("DROP TABLE IF EXISTS public.asaas_accounts CASCADE");
  await pool.query(`
    CREATE TABLE public.asaas_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
      asaas_customer_id text NOT NULL UNIQUE,
      wallet_id text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'PENDING',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  console.log("OK: asaas_accounts table created");
  await pool.end();
}

main().catch((e) => {
  console.error("ERR:", e.message);
  pool.end();
  process.exit(1);
});