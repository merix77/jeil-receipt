const sheets = require('../config/google');

// pg returns NUMERIC as a string; write as a number so the sheet cell is
// numeric and SUM() over the 물량/판매량 컬럼 works.
const num = (v) => (v == null ? '' : Number(v));

const DOC_TYPES = {
  purchase: {
    spreadsheetIdEnv: 'SHEET_ID_PURCHASE',
    toRow: (item) => [
      item.trade_date,
      item.meat_type,
      num(item.weight_kg),
      item.origin,
      item.cut_name,
      item.grade,
      item.slaughterhouse,
      item.trace_number,
      item.supplier,
    ],
  },
  sale: {
    spreadsheetIdEnv: 'SHEET_ID_SALES',
    toRow: (item) => [
      item.trade_date,
      item.supplier,
      item.cut_name,
      num(item.weight_kg),
      item.note,
    ],
  },
};

// The first tab is the blank form: month tabs are duplicated from it so they
// keep the title/서식/헤더 exactly, instead of being bare sheets.
async function ensureMonthTab(spreadsheetId, sheetList, month) {
  if (sheetList.some((s) => s.properties.title === month)) return;

  const template = [...sheetList].sort((a, b) => a.properties.index - b.properties.index)[0];
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          duplicateSheet: {
            sourceSheetId: template.properties.sheetId,
            newSheetName: month,
            insertSheetIndex: sheetList.length, // 원본 양식 탭은 항상 첫 번째로 유지
          },
        },
      ],
    },
  });
}

// Writes below whatever the tab already holds. Deterministic instead of
// values.append, whose table detection can misfire on the blank row inside
// the form header and overwrite it.
async function writeBelowExisting(spreadsheetId, tab, values) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A:A`,
  });
  const startRow = (existing.data.values || []).length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A${startRow}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

async function appendRows(docType, items) {
  const spec = DOC_TYPES[docType];
  const spreadsheetId = process.env[spec.spreadsheetIdEnv];
  const sorted = [...items].sort((a, b) => a.trade_date.localeCompare(b.trade_date));

  // Group rows by trade month so each lands on its own month tab.
  const byMonth = new Map();
  for (const item of sorted) {
    const month = item.trade_date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(spec.toRow(item));
  }

  for (const [month, values] of byMonth) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    await ensureMonthTab(spreadsheetId, meta.data.sheets, month);
    await writeBelowExisting(spreadsheetId, month, values);
  }
}

// ===== 기능 B. 돼지 수율표 =====
const { YIELD_PARTS } = require('../config/yieldParts');
// 부위 순서·이름은 상수에서 파생(별도 하드코딩 금지) — 부위 수가 바뀌어도 자동 반영
const YIELD_PART_ORDER = YIELD_PARTS.map((p) => p.name);
const SUMMARY_TAB = '요약';
const SUMMARY_HEADER = ['날짜', '돈가(원/kg)', '총중량(kg)', '총매입가(원)', '총매출액(원)', '마진금액(원)', '마진율(%)'];

async function ensureBlankTab(spreadsheetId, sheetList, title) {
  if (sheetList.some((s) => s.properties.title === title)) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
}

// CLAUDE.md 4-1: 공통정보(세로) → 빈 줄 → 부위 가로표 → 빈 줄 → 결과(세로)
function yieldDetailBlock(m, parts) {
  const byOrder = new Map(parts.map((p) => [Number(p.part_order), p]));
  const ordered = YIELD_PART_ORDER.map((_, i) => byOrder.get(i + 1));
  const cell = (v) => (v == null || v === '' ? '' : Number(v));
  return [
    ['날짜', m.measured_date],
    ['돈가(원/kg)', cell(m.price_per_kg)],
    ['총중량(kg)', cell(m.total_weight_kg)],
    ['총매입가(원)', cell(m.total_purchase_price)],
    [],
    ['부위명', ...YIELD_PART_ORDER],
    ['중량(kg)', ...ordered.map((p) => cell(p.weight_kg))],
    ['판매단가(원/kg)', ...ordered.map((p) => cell(p.unit_price))],
    ['매출액(원)', ...ordered.map((p) => cell(p.revenue))],
    ['마진포함', ...ordered.map((p) => (p.margin_included ? 'O' : 'X'))],
    [],
    ['총매출액(원)', cell(m.total_revenue)],
    ['마진금액(원)', cell(m.margin_amount)],
    ['마진율(%)', cell(m.margin_rate)],
  ];
}

// 상세 탭(YYYY-MM) → 요약 탭 순서로 기록. 상세 먼저, 요약 나중(부분 실패 안전장치 없음).
async function appendYield(measurement, parts) {
  const spreadsheetId = process.env.SHEET_ID_YIELD;
  const month = String(measurement.measured_date).slice(0, 7);
  const num = (v) => (v == null || v === '' ? '' : Number(v));

  // 1) 상세 탭
  let meta = await sheets.spreadsheets.get({ spreadsheetId });
  await ensureBlankTab(spreadsheetId, meta.data.sheets, month);
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${month}'!A:A` });
  const hasContent = (existing.data.values || []).length > 0;
  const block = yieldDetailBlock(measurement, parts);
  // 이미 블록이 있으면 사이에 빈 줄 1개
  await writeBelowExisting(spreadsheetId, month, hasContent ? [[], ...block] : block);

  // 2) 요약 탭 (없으면 생성) — 탭이 비어 있으면 헤더부터 기록
  meta = await sheets.spreadsheets.get({ spreadsheetId });
  await ensureBlankTab(spreadsheetId, meta.data.sheets, SUMMARY_TAB);
  const summaryA = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${SUMMARY_TAB}'!A:A` });
  if ((summaryA.data.values || []).length === 0) {
    await writeBelowExisting(spreadsheetId, SUMMARY_TAB, [SUMMARY_HEADER]);
  }
  await writeBelowExisting(spreadsheetId, SUMMARY_TAB, [[
    measurement.measured_date,
    num(measurement.price_per_kg),
    num(measurement.total_weight_kg),
    num(measurement.total_purchase_price),
    num(measurement.total_revenue),
    num(measurement.margin_amount),
    num(measurement.margin_rate),
  ]]);
}

module.exports = { appendRows, appendYield };
