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

module.exports = { appendRows };
