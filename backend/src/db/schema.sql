CREATE TABLE receipts (
  id              SERIAL PRIMARY KEY,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  is_deleted      BOOLEAN DEFAULT FALSE,
  image_url       TEXT NOT NULL,
  ocr_raw_json    JSONB,
  sheet_synced    BOOLEAN DEFAULT FALSE,
  sheet_synced_at TIMESTAMP,
  sync_error      TEXT
);

CREATE TABLE receipt_items (
  id                SERIAL PRIMARY KEY,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  is_deleted        BOOLEAN DEFAULT FALSE,
  receipt_id        INTEGER NOT NULL REFERENCES receipts(id),
  trade_date        DATE NOT NULL,
  meat_type         VARCHAR(50),
  weight_kg         NUMERIC(10,2),
  origin            VARCHAR(50),
  cut_name          VARCHAR(50),
  grade             VARCHAR(20),
  slaughterhouse    VARCHAR(100),
  trace_number      VARCHAR(50),
  supplier          VARCHAR(100),
  is_uncertain      BOOLEAN DEFAULT FALSE,
  uncertain_fields  TEXT[]
);
