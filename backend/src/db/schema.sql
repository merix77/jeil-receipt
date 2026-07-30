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


-- ===== 기능 B. 돼지 수율표 =====
-- 측정 1건 = yield_measurements 1행 (요약 탭 1행과 1:1) + yield_parts 12행(부위)
CREATE TABLE yield_measurements (
  id                    SERIAL PRIMARY KEY,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  is_deleted            BOOLEAN DEFAULT FALSE,
  measured_date         DATE NOT NULL,           -- 날짜 (UNIQUE 아님: 같은 날 여러 건 허용)
  price_per_kg          NUMERIC(10,2),           -- 돈가(원/kg), 참고 기록용
  total_weight_kg       NUMERIC(10,2),           -- 총중량(이분도체 기준)
  total_purchase_price  NUMERIC(12,2),           -- 총매입가(직접 입력)
  total_revenue         NUMERIC(12,2),           -- 총매출액(마진 포함 7부위 합) — yield_parts에서 파생
  margin_amount         NUMERIC(12,2),           -- 마진금액 — 파생
  margin_rate           NUMERIC(5,1),            -- 마진율(%), 소수 1자리 — 파생
  sheet_synced          BOOLEAN DEFAULT FALSE,
  sheet_synced_at       TIMESTAMP,
  sync_error            TEXT
);

-- 부위 상세: 측정 1건당 순서 1~12로 12행 고정. 미입력 부위도 NULL 행으로 보존.
-- 자식 행은 마스터와 함께 살고 죽으므로 is_deleted를 두지 않는다(마스터의 is_deleted로 충분).
CREATE TABLE yield_parts (
  id                SERIAL PRIMARY KEY,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  measurement_id    INTEGER NOT NULL REFERENCES yield_measurements(id),
  part_order        SMALLINT NOT NULL,           -- 1=삼겹 … 12=미니족
  part_name         VARCHAR(20) NOT NULL,
  weight_kg         NUMERIC(10,2),               -- 등뼈·미니족·미입력은 NULL
  unit_price        NUMERIC(12,2),               -- 〃
  revenue           NUMERIC(12,2),               -- 중량×단가 (등뼈·미니족 고정 5000)
  margin_included   BOOLEAN NOT NULL,            -- 1~10 true, 등뼈·미니족 false
  -- 측정 1건당 부위 순서는 유일해야 함(중복 행이 들어가면 합계가 조용히 틀어짐)
  UNIQUE (measurement_id, part_order)
);

-- 날짜 조회 경로용. (측정별 부위 조회는 위 UNIQUE 인덱스의 measurement_id 선두 컬럼이 커버)
CREATE INDEX idx_yield_measurements_date ON yield_measurements (measured_date);
