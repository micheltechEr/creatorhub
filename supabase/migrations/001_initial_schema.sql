-- ============================================================
-- ArtistFlow — Initial Schema Migration
-- Target: Supabase (PostgreSQL 15+)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ARTISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS artists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  categories    TEXT[] NOT NULL DEFAULT '{}',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  base_price    NUMERIC(10, 2) NOT NULL,
  delivery_days INTEGER NOT NULL,
  availability  BOOLEAN NOT NULL DEFAULT TRUE,
  rating        NUMERIC(3, 2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL,
  artist_id               UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT,
  occasion                TEXT,
  names                   TEXT[] NOT NULL DEFAULT '{}',
  reference_links         TEXT[] NOT NULL DEFAULT '{}',
  deadline                TIMESTAMPTZ NOT NULL,
  additional_instructions TEXT,
  base_price              NUMERIC(10, 2) NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED','PAYMENT_PENDING','PAID','IN_PROGRESS','DELIVERED','CANCELLED')),
  client_name             TEXT NOT NULL,
  client_email            TEXT NOT NULL,
  client_cpf_cnpj         TEXT,
  delivery_video_url      TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_artist_id ON orders(artist_id);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount              BIGINT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'BRL',
  status              TEXT NOT NULL DEFAULT 'PENDING',
  provider            TEXT NOT NULL,
  transaction_id      TEXT NOT NULL UNIQUE,

  -- Asaas-specific fields
  billing_type        TEXT,
  asaas_payment_id    TEXT,
  asaas_customer_id   TEXT,
  checkout_url        TEXT,
  invoice_url         TEXT,
  boleto_url          TEXT,
  pix_qr_code         TEXT,
  pix_copia_e_cola    TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- ============================================================
-- MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_size   BIGINT NOT NULL,
  file_url    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_artist_id ON media(artist_id);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  artist_id  UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  client_id  UUID NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_artist_id ON reviews(artist_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order_unique ON reviews(order_id);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE,
  artist_id  UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_artist_id ON refresh_tokens(artist_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token     ON refresh_tokens(token);

-- ============================================================
-- TRIGGERS — auto-update updated_at on artists, orders, payments
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_artists_updated_at  ON artists;
DROP TRIGGER IF EXISTS trg_orders_updated_at   ON orders;
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;

CREATE TRIGGER trg_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TRIGGER — keep artists.rating + total_reviews in sync
-- ============================================================
CREATE OR REPLACE FUNCTION sync_artist_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_artist_id UUID;
BEGIN
  v_artist_id := COALESCE(NEW.artist_id, OLD.artist_id);

  UPDATE artists
  SET
    rating        = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE artist_id = v_artist_id),
    total_reviews = (SELECT COUNT(*)                  FROM reviews WHERE artist_id = v_artist_id),
    updated_at    = NOW()
  WHERE id = v_artist_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_artist_rating ON reviews;

CREATE TRIGGER trg_sync_artist_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION sync_artist_rating();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — enable but keep permissive for
-- server-side access (the API server uses the service_role key
-- which bypasses RLS automatically).
-- ============================================================
ALTER TABLE artists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE media          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Allow full access from service_role (bypasses RLS by default in Supabase)
-- Allow read-only anon access to public artist profiles
CREATE POLICY IF NOT EXISTS "anon_read_artists"  ON artists  FOR SELECT USING (TRUE);
CREATE POLICY IF NOT EXISTS "anon_read_reviews"  ON reviews  FOR SELECT USING (TRUE);
