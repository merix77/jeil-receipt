-- 기능 B. 돼지 수율표 — 기존 DB에 적용 (재실행 안전)
-- 실행: psql "$DATABASE_URL" -f src/db/migrations/002_yield.sql

CREATE TABLE IF NOT EXISTS yield_measurements (
  id                    SERIAL PRIMARY KEY,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  is_deleted            BOOLEAN DEFAULT FALSE,
  measured_date         DATE NOT NULL,
  price_per_kg          NUMERIC(10,2),
  total_weight_kg       NUMERIC(10,2),
  total_purchase_price  NUMERIC(12,2),
  total_revenue         NUMERIC(12,2),
  margin_amount         NUMERIC(12,2),
  margin_rate           NUMERIC(5,1),
  sheet_synced          BOOLEAN DEFAULT FALSE,
  sheet_synced_at       TIMESTAMP,
  sync_error            TEXT
);

CREATE TABLE IF NOT EXISTS yield_parts (
  id                SERIAL PRIMARY KEY,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  measurement_id    INTEGER NOT NULL REFERENCES yield_measurements(id),
  part_order        SMALLINT NOT NULL,
  part_name         VARCHAR(20) NOT NULL,
  weight_kg         NUMERIC(10,2),
  unit_price        NUMERIC(12,2),
  revenue           NUMERIC(12,2),
  margin_included   BOOLEAN NOT NULL,
  UNIQUE (measurement_id, part_order)
);

CREATE INDEX IF NOT EXISTS idx_yield_measurements_date ON yield_measurements (measured_date);
