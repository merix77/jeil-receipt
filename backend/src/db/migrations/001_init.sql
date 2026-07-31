-- 기능 A. base 스키마 (재실행 안전). 빈 DB에서도 migrate.js만으로 전체가 생성되도록 편입.
CREATE TABLE IF NOT EXISTS receipts (
  id              SERIAL PRIMARY KEY,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  is_deleted      BOOLEAN DEFAULT FALSE,
  doc_type        VARCHAR(10) NOT NULL DEFAULT 'purchase', -- 'purchase'(매입분) | 'sale'(판매분)
  image_url       TEXT NOT NULL,
  ocr_raw_json    JSONB,
  sheet_synced    BOOLEAN DEFAULT FALSE,
  sheet_synced_at TIMESTAMP,
  sync_error      TEXT
);

CREATE TABLE IF NOT EXISTS receipt_items (
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

-- 판매분 지원 컬럼(과거 ad-hoc ALTER를 마이그레이션으로 편입).
-- 위 CREATE에 이미 포함되지만, doc_type/note 이전에 만들어진 오래된 테이블에도 안전하게 추가.
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS doc_type VARCHAR(10) NOT NULL DEFAULT 'purchase';
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS note TEXT;
