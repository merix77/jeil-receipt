CREATE TABLE receipts (
  id              SERIAL PRIMARY KEY,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  is_deleted      BOOLEAN DEFAULT FALSE,
  doc_type        VARCHAR(10) NOT NULL DEFAULT 'purchase', -- 'purchase'(매입분) | 'sale'(영업자간 판매분)
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
  note              TEXT,
  is_uncertain      BOOLEAN DEFAULT FALSE,
  uncertain_fields  TEXT[]
);

-- 판매분(doc_type='sale') 필드 대응:
--   판매년월일 → trade_date / 판매처 → supplier / 판매부위 → cut_name
--   판매량 → weight_kg / 비고 → note
-- (매입분에만 있는 축종·원산지·등급·도축장명·이력번호는 판매분에서 NULL)
