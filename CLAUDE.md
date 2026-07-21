# 거래내역서 OCR 앱 (제일축산 PREMIUM)

종이 거래내역서를 촬영하면 Claude Vision으로 항목을 추출해, 사용자 확인 후 구글시트에 자동 입력하는 개인용 PWA.

## 사용자 / 배포
- 사용자 1명 (본인), 하루 5~10건 촬영
- 배포: PWA — 앱스토어 배포 없음, 프론트는 Vercel, 백엔드는 Railway, 홈 화면 추가로 사용

## OCR/추출 엔진 (결정 변경 이력 있음 — 주의해서 읽을 것)

**현재 결정 (최신)**: 우선 **Gemini API 무료 티어**(`gemini-2.5-flash`)로 테스트 진행. 인식 정확도가 불안정하면 그때 **Claude Sonnet 5**로 전환하기로 함.

**원래 결정이었던 이유 (여전히 유효한 제약)**: `trace_number`(이력번호), `slaughterhouse`(도축장명)는 축산물이력법상 법정 기재사항이라 오인식이 법적 리스크로 이어짐. 이 때문에 애초엔 Haiku 등 저가 모델도 배제하고 Sonnet 5로 못박았었음.

**따라서 Gemini로 테스트하는 동안에도 반드시 지킬 것**
- 확신도 낮은 필드(특히 이력번호·도축장명)는 UI에서 강하게 강조 표시하고, 사용자가 원본 사진과 대조 후 확인해야만 시트에 반영되게 유지
- 실사용(매장 실제 업무) 전환 시점엔 이 결정을 반드시 재검토
- Gemini 무료 티어는 데이터가 구글 모델 학습에 활용될 수 있음 — 사업자 정보 수준이라 허용은 했으나, 규모 커지면 유료 전환 고려

## 기술 스택
- 프론트엔드: React + Vite
- 백엔드: Node.js + Express
- DB: PostgreSQL
- 시트 연동: Google Sheets API, 서비스 계정 인증


## 구글 서비스 계정
- 프로젝트 ID: `spiritual-hour-503102-a6`
- 서비스 계정 이메일: `transaction-statement@spiritual-hour-503102-a6.iam.gserviceaccount.com`
- JSON 키는 로컬에만 보관, **절대 커밋 금지** — `.gitignore`에 반드시 포함

## 대상 구글시트 (4개, 서비스 계정 편집자 공유 완료)
| 시트 | 스프레드시트 ID |
|---|---|
| 매입 (거래내역서 매입분) | `1IjsAKLfwiGti0KRZEsf_YYNoM0iKfIR-J1pcNoIiWYY` |
| 판매 (영업자간 거래내역서) | `121YEYosIYgtdzpJAuAyRLEOqRS5PKEhl-1hxRO7oJjk` |
| 위생점검표 (자체위생관리기준 점검표) | `1_Ud__ZfAFF8xFhfMa-oWkfC0YSx6otrrSE5tdBGiFnY` |
| 위생교육결과서 (종업원 위생교육 실시 결과서) | `1vVdyIGuYhGELd8OZHaSNyjGXqqOOapcXAk44kkJsUWM` |

매입 시트 컬럼 순서: 거래년월일 / 식육·포장육의 종류 / 물량(kg) / 원산지 / 부위명칭 / 등급 / 도축장명 / 이력번호 / 매입처

## DB 스키마 (영문 스네이크케이스)

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
```

## OCR 추출 프롬프트 (매입 기준, 필요시 판매/위생 문서용으로 변형)

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
- 품목란이 합쳐져 있으면 축종/부위/등급을 각각의 필드로 분리
- 한 품목 = 한 행
- 값을 찾을 수 없으면 빈 문자열("")
- 읽기 어려운 글자는 추정값 뒤에 "?" 표시
- 반드시 유효한 JSON 배열만 응답
```

## API 흐름
1. `POST /receipts` — 이미지 업로드 → S3/로컬 저장 → `receipts` row 생성 → Claude Vision 호출 → `receipt_items` 저장 → 추출 결과 응답(확신도 낮은 필드 flag 포함)
2. `PATCH /receipts/:id/items` — 사용자 수정 반영
3. `POST /receipts/:id/confirm` — 날짜순 정렬 → Google Sheets API append → 성공 시 `sheet_synced=true`, 실패 시 `sync_error` 기록
4. `GET /receipts` — 이력 조회

표준 응답: `{ success, data, message }` / `{ success: false, error, code }`

## UI/디자인 컨셉 — "디지털 장부"
- 배경(종이) `#FAF7F1` / 보조 배경 `#F1ECE1` / 먹색 텍스트 `#2B2724` / 보조 텍스트 `#8A8071` / 액센트(인주 레드) `#AF3226` / 구분선 `#DDD5C7`
- 제목: Noto Serif KR(bold) / 본문·데이터: Noto Sans KR (또는 Pretendard)
- 카드 그림자보다 장부처럼 가로줄(hairline) 구분
- 시트 반영 완료 시 붉은 원형 도장(印) 마크로 표시
- 촬영 즉시 전송 금지 — 반드시 확인/수정 화면을 거친 뒤에만 전송

## 코딩 원칙

**1. 코딩 전에 먼저 생각할 것**
- 요청이 모호하거나 이해되지 않는 부분이 있으면 섣불리 코드 작성을 시작하지 말고 먼저 질문할 것 (자가 판단·추측 금지)
- 구현 방식이 여러 개 있는 경우 임의로 하나를 고르지 말고, 각 방식의 장단점(트레이드오프)과 함께 선택지를 제시할 것
- 실행 전에 가정한 내용을 명확히 밝히고, 더 간단한 해결책이 있다면 먼저 언급하고 의견을 물을 것

**2. 단순함을 최우선으로 할 것**
- 문제 해결에 필수적인 최소한의 코드만 작성 — 요청하지 않은 추가 기능이나 유연성은 구현하지 않음
- 일회성 코드나 단순 작업에 불필요한 Class, Interface, 디자인 패턴 등의 추상화 지양
- 작성된 코드가 필요 이상으로 길면(예: 200줄로 짠 걸 50줄로 줄일 수 있다면) 구조를 단순화해서 다시 작성
- "복잡하다"고 느껴지는 구조는 즉시 가독성과 유지보수가 쉬운 단순한 구조로 변경

**3. 디버깅 코드는 최소한으로, 반드시 정리할 것**
- 원인 파악을 위해 로그가 필요하면 `console.log`/`console.error` 한두 줄만 추가 — 새 컴포넌트나 새 상태(state)를 만들어서 디버깅하지 말 것 (디버그용 컴포넌트가 렌더링 규칙을 어겨 화면 전환 같은 실제 기능을 깨뜨린 사례가 있었음)
- 디버깅용으로 추가한 코드는 원인 확인 후 반드시 제거하고, 제거했다고 명시적으로 알릴 것
- 디버깅 코드를 추가한 직후에는 원래 하려던 동작(예: 화면 전환, API 호출 흐름)이 여전히 정상 작동하는지 한 번 더 확인 후 결과를 보고할 것

## 작업 규칙
- Kiwoom API, 외부 시스템 응답 구조 등 기술적으로 불확실한 부분은 추측하지 말고 먼저 물어볼 것 (이 프로젝트엔 해당 없지만 JEIL Labs 공통 규칙)
- 커밋/푸시는 확인 없이 자동으로 진행
- 영어 스크린샷 공유 시 한국어 번역 병기
