# 작업 현황 (2026-07-22 기준)

> 프로젝트 사양은 `CLAUDE.md` 참고. 이 문서는 **실제로 구현된 것 / 사양과 달라진 것 / 함정**만 정리.

## 현재 상태

로컬에서 전 기능 동작 확인 완료. **GitHub 저장소는 아직 없음**(로컬 커밋만). 배포 전 단계.

```
backend/   Express + PostgreSQL + Gemini 2.5 Flash + Google Sheets API
frontend/  React + Vite PWA (HTTPS dev server)
```

## 구현된 API (전부 `x-api-key` 헤더 필요)

| Method | Path | 설명 |
|---|---|---|
| POST | `/receipts` | 이미지 + `doc_type`(purchase\|sale) → OCR → 항목 저장 |
| PATCH | `/receipts/:id/items` | 사용자 수정 반영 |
| POST | `/receipts/:id/confirm` | `doc_type`에 맞는 구글시트(매입/판매)에 반영 |
| GET | `/receipts?month=YYYY-MM` | 목록 조회 (items 포함, month 생략 가능) |
| GET | `/receipts/:id/image` | 원본 사진 |
| POST | `/hygiene/check` | 위생점검표 자동 O 등록 |
| POST | `/hygiene/education` | 위생교육 결과서 생성 |

(CLAUDE.md의 API 흐름 항목에 전부 반영되어 있음)

## 화면 (frontend/src/pages/)

- **HomeScreen** — 📷 매입 촬영하기 / 📷 판매 촬영하기 / 갤러리 선택 링크 2개 / 🔍 거래내역 조회하기 / 위생점검·위생교육 카드 2개 / 오늘 기록 건수 / 위생 시트 바로가기 링크
- **ReviewScreen** — 매입/판매에 맞는 필드만 표시, 항목별 수정, "?" 남으면 기록 차단, "장부에 기록하기"
- **HistoryScreen** — 월별 조회(매입·판매 함께, 배지로 구분), 행 펼치면 원본 사진 + 항목 표 + 미반영 건 재전송, 반영 완료는 도장(印)

## 사양에서 달라진/추가된 결정

1. **OCR 엔진**: Gemini 2.5 Flash 무료 티어 사용 중 (CLAUDE.md대로). **하루 20건 한도** — 테스트 몰아서 하면 바로 소진되고 한국시간 오후 4~5시경 초기화. 실사용(하루 5~10건)엔 충분.
2. **후면 카메라**: `<input capture="environment">`는 안드로이드 크롬이 무시함(전면 카메라 열림). → `getUserMedia({facingMode:'environment'})` 커스텀 촬영 UI(`components/CameraCapture.jsx`)로 해결. 카메라 API는 HTTPS 필수라 **dev 서버가 HTTPS**(`@vitejs/plugin-basic-ssl`), mixed content 회피 위해 `/receipts`·`/hygiene`을 vite proxy로 우회. 폰 접속은 반드시 `https://192.168.219.150:5173` (인증서 경고 → 고급 → 계속).
3. **매입/판매 구분**: 홈 화면에서 **촬영 전에 버튼으로 선택**(자동 판별 아님). `receipts.doc_type`(`purchase`|`sale`)에 저장되고, OCR 프롬프트·확인 화면 필드·기록될 시트가 모두 이 값으로 갈립니다. 판매분은 별도 테이블 없이 매입 컬럼 재사용 — 판매년월일→`trade_date` / 판매처→`supplier` / 판매부위→`cut_name` / 판매량→`weight_kg` / 비고→`note`.
4. **월별 탭 자동 생성**:
   - 매입 시트 → 거래일자 기준 `YYYY-MM` 탭 (없으면 헤더와 함께 생성)
   - 판매 시트 → 판매일자 기준 `YYYY-MM` 탭 (동일 방식, 5개 컬럼 헤더)
   - 위생점검표 → `YYYY-MM` 탭 (원본 "위생점검표" 템플릿 복제)
   - 위생교육 → `YYYY-MM-DD` 날짜별 탭 (원본 "위생교육결과서" 템플릿 복제)
5. **위생 문서 백필**: 며칠 밀려도 버튼 한 번에 누락분 전부 등록. 점검표는 표시 없는 날만 채움(직접 넣은 △/X는 보존), 교육은 마지막 등록일 다음날~오늘 (최대 31일).
6. **고정값** (`backend/src/config/business.js`): 점검자 노영곤 / 장소 제일축산 / 교육시간 30분~1시간 / 대상 전직원 / 참석 2명. 교육 주제·내용은 샘플 10종 순환(`services/educationService.js`).
7. **중복 등록 차단**: 추출된 모든 항목이 이미 DB에 있으면 409로 거부. 매입은 (거래일자+이력번호), 판매는 이력번호가 없어 (판매일자+판매처+부위+판매량) 조합으로 대조.
8. **위생점검/교육 조회는 앱에 없음** — 구글시트 바로가기 링크로 처리(하이브리드 A안).

## 함정 (반드시 알고 있을 것)

- **`.env` 파일은 도구로 읽기/쓰기 불가** (권한 차단). 값 변경이 필요하면 **사용자에게 직접 수정 요청**해야 함.
- **시트 ID 오타 주의**: 매입 시트 ID에 대문자 `I` / 소문자 `l` 혼동으로 404를 겪었음(현재는 `.env`·CLAUDE.md 모두 정상값 `...YYNoM0iKflR-...`). 시트 ID를 손으로 옮겨적을 때 주의.
- **이력번호 앞자리 0 보존**: 시트 기록은 반드시 `valueInputOption: 'RAW'`. `USER_ENTERED`면 `012345...` → `12345...`로 깨짐 (법정 기재사항).
- **날짜는 전부 KST 기준**: `backend/src/utils/date.js`, `frontend/src/dates.js`만 사용. `toISOString().slice(0,10)` 쓰면 오전 9시 이전 기록이 하루 밀림. Node `TZ`와 PG 세션 타임존도 Asia/Seoul 고정(`app.js`, `config/db.js`).
- **pg DATE 파서 오버라이드**: `config/db.js`에서 DATE(oid 1082)를 문자열로 받게 해둠. 이걸 되돌리면 시간대 변환으로 날짜가 밀림.
- **OCR "?" 표시**: 프롬프트가 불확실한 값에 "?"를 붙이라고 지시함. 날짜·중량은 백엔드에서 정규화해 `uncertain_fields`에 기록(그대로 두면 DATE/NUMERIC 캐스팅 에러). UI는 "?" 또는 `uncertain_fields`로 강조 표시.
- **서버 재시작**: nodemon은 `.js`만 감시. `.env` 변경 시 자동 재시작 안 됨.

## 남은 일

1. GitHub 저장소 생성 + 푸시 (remote 없음, `gh` CLI 미설치)
2. 배포 — 프론트 Vercel / 백엔드 Railway. **Railway는 Persistent Volume 필수**(없으면 재배포 시 `uploads/` 사진 전부 소실). 배포 시 `frontend/.env`의 `VITE_API_BASE_URL`을 Railway 주소로, vite proxy 설정 재검토 필요.
3. PWA 아이콘 미설정 (`vite.config.js`의 `icons: []`)
4. **판매분 OCR은 실제 사진으로 미검증** — DB→시트 경로는 모의 데이터로 확인했으나, 판매 양식 사진을 Gemini가 제대로 읽는지는 실물 촬영 테스트 필요 (`SALE_PROMPT` 조정 가능성)
5. 실사용 전환 시 Gemini 정확도 재검토 → 필요시 Claude Sonnet 5 전환 (에러 처리는 `services/ocrService.js`에 격리해둬서 그 파일만 고치면 됨)
