# 거래내역서 OCR 앱 — 개발 브리프

## 1. 프로젝트 개요

종이로 된 축산물 거래내역서(거래명세서)를 촬영하면, Claude Vision API로 항목을 자동 추출해 사용자 확인 후 Google Sheets에 자동 입력하는 개인용 웹앱(PWA).

- **사용자**: 1인 (고니), 하루 5~10건 촬영
- **배포**: PWA — 앱스토어 배포 없이 URL을 폰 홈 화면에 추가해서 사용
- **참고 벤치마킹**: 육기통(축산물판매업자 대상 앱, 거래명세표 촬영→구글 OCR→법적 거래내역서 전환 기능 보유)

---

## 2. 기술 스택 (JEIL Labs 표준)

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | React + Vite |
| 백엔드 | Node.js + Express |
| DB | PostgreSQL |
| OCR/추출 | Claude API (Sonnet 5) |
| 시트 연동 | Google Sheets API (서비스 계정 인증) |
| 배포 | Vercel(프론트) + Railway(백엔드) |

---

## 3. DB 스키마

```sql
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

CREATE INDEX idx_receipt_items_trade_date ON receipt_items(trade_date);
CREATE INDEX idx_receipts_sheet_synced ON receipts(sheet_synced);
```

**구글시트 컬럼 순서 (그대로 매핑)**
거래년월일 | 식육·포장육의 종류 | 물량(kg) | 원산지 | 부위명칭 | 등급 | 도축장명 | 이력번호 | 매입처

---

## 4. OCR 추출 프롬프트 (Claude Vision, Sonnet 5)

```
다음은 축산물 거래명세서(또는 거래내역서) 사진입니다.
아래 JSON 배열 형식으로만 응답하세요. 설명, 코드블록 표시, 다른 텍스트는 절대 포함하지 마세요.

[
  {
    "trade_date": "YYYY-MM-DD",
    "meat_type": "한우 또는 육우 등 축종",
    "weight_kg": "숫자 문자열",
    "origin": "",
    "cut_name": "안심, 등심 등 부위",
    "grade": "1++, 2 등 등급 표기",
    "slaughterhouse": "",
    "trace_number": "",
    "supplier": "공급자(매도인) 상호"
  }
]

규칙:
- 품목란이 "한우안심(암/1++/냉장)" 형태로 합쳐져 있으면 축종/부위/등급을 각각의 필드로 분리하세요
- 한 품목 = 한 행. 품목이 여러 개면 배열 원소도 여러 개로 만드세요
- 값을 사진에서 찾을 수 없으면 빈 문자열("")로 두세요
- 글씨가 흐리거나 도장에 가려 읽기 어려운 경우, 최선의 추정값 뒤에 "?"를 붙이세요
- 반드시 유효한 JSON 배열만 응답하세요
```

**주의**: `trace_number`, `slaughterhouse`는 축산물이력법상 법정 기재사항 → 오인식 시 법적 리스크. 확신도 낮은 필드는 UI에서 반드시 강조 표시 후 사용자 확인 거칠 것.

---

## 5. API 흐름

```
1. POST /receipts  (이미지 업로드)
   → S3/로컬 저장 → receipts row 생성 (sheet_synced=false)
   → Claude Vision 호출 → receipt_items 저장
   → 추출 결과 응답 (확신도 낮은 필드 flag 포함)

2. PATCH /receipts/:id/items  (사용자 수정 반영)

3. POST /receipts/:id/confirm  (사용자 "장부에 기록하기" 클릭)
   → 날짜순 정렬 → Google Sheets API append
   → 성공: sheet_synced=true, sheet_synced_at 기록
   → 실패: sync_error 기록, 재시도 가능하게 남김

4. GET /receipts  (이력 조회, 날짜별 그룹)
```

**표준 응답 형식 (JEIL 컨벤션)**
```json
// 성공
{ "success": true, "data": { ... }, "message": "처리 완료" }
// 실패
{ "success": false, "error": "에러 메시지", "code": "ERROR_CODE" }
```

---

## 6. UI/디자인 컨셉 — "디지털 장부"

종이 장부를 대체하는 도구라는 컨셉. 실제 문서의 인주(직인) 색을 액센트로 사용.

**토큰**
- 배경(종이): `#FAF7F1` / 보조 배경: `#F1ECE1`
- 텍스트(먹색): `#2B2724` / 보조 텍스트: `#8A8071`
- 액센트(인주 레드): `#AF3226`
- 구분선: `#DDD5C7`
- 타이포: 제목 Noto Serif KR(bold) / 본문·데이터 Noto Sans KR (Pretendard 대체 가능)

**화면 구성 (3개)**
1. **촬영 화면** — 큰 원형 카메라 버튼(레드), 오늘 기록 건수 요약
2. **확인 화면** — 항목별 카드 + 인풋, 확신도 낮은 필드는 붉은 테두리+배경 강조, "장부에 기록하기" 버튼으로 시트 전송
3. **이력 화면** — 반영 완료 건은 붉은 원형 도장 마크(畢), 실패 건은 X 표시

**UI 원칙**
- 카드형 그림자보다 장부처럼 가로줄(hairline) 구분 사용
- 촬영 즉시 전송 금지 — 반드시 확인/수정 단계 거친 후 전송
- 라운드/장식 최소화, 여백과 라인으로 구조 표현

---

## 6-1. 구글시트 ID (확보 완료)

| 시트 | 스프레드시트 ID |
|---|---|
| 매입 (거래내역서 매입분) | `1IjsAKLfwiGti0KRZEsf_YYNoM0iKfIR-J1pcNoIiWYY` |
| 판매 (영업자간 거래내역서) | `121YEYosIYgtdzpJAuAyRLEOqRS5PKEhl-1hxRO7oJjk` |
| 위생점검표 (자체위생관리기준 점검표) | `1_Ud__ZfAFF8xFhfMa-oWkfC0YSx6otrrSE5tdBGiFnY` |
| 위생교육결과서 (종업원 위생교육 실시 결과서) | `1vVdyIGuYhGELd8OZHaSNyjGXqqOOapcXAk44kkJsUWM` |

4개 시트 모두 서비스 계정(`transaction-statement@spiritual-hour-503102-a6.iam.gserviceaccount.com`)에 편집자 권한 공유 완료.

## 7. 필요 사전 준비 (사용자 액션)

- [ ] Google Cloud 프로젝트 생성 → Sheets API 활성화 → 서비스 계정 키(JSON) 발급 → 대상 시트에 서비스 계정 이메일 편집자로 공유
- [ ] Anthropic API 키 발급
- [ ] Vercel / Railway 계정 생성

## 8. 예상 비용 (월, 개인 사용 기준)

- Claude API (Sonnet 5, 하루 5~10건): 약 1,200~3,300원
- Vercel/Railway: 무료 티어로 충분
- 앱스토어 비용: 없음 (PWA)

---

## 9. 개발 순서

| 단계 | 작업 | 상태 |
|---|---|---|
| 1 | 구글 서비스 계정 준비 + 시트 4개 생성·공유 | **완료** |
| 2 | OCR 프롬프트 검증 | 프로토타입으로 검증 진행 중 |
| 3 | 백엔드 개발 (Express + Claude API + Sheets API) | 예정 |
| 4 | 프론트엔드 개발 (React, 위 디자인 반영) | UI 시안 완료 |
| 5 | 통합 테스트 | 예정 |
| 6 | 배포 (Vercel + Railway) | 예정 |
| 7 | 홈 화면 설치 | 예정 |
| 8 | 운영/모니터링 | 예정 |
