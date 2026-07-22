const sheets = require('../config/google');

const PURCHASE_HEADER = [
  '거래년월일',
  '식육·포장육의 종류',
  '물량(kg)',
  '원산지',
  '부위명칭',
  '등급',
  '도축장명',
  '이력번호',
  '매입처',
];

const SALE_HEADER = ['판매년월일', '판매처', '판매부위', '판매량', '비고'];

// pg returns NUMERIC as a string; append as a number so the sheet cell is
// numeric and SUM() over the 물량/판매량 column works.
const num = (v) => (v == null ? '' : Number(v));

const DOC_TYPES = {
  purchase: {
    spreadsheetIdEnv: 'SHEET_ID_PURCHASE',
    header: PURCHASE_HEADER,
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
    header: SALE_HEADER,
    toRow: (item) => [
      item.trade_date,
      item.supplier,
      item.cut_name,
      num(item.weight_kg),
      item.note,
    ],
  },
};

// Tab per trade month, e.g. "2026-07". Created (with header) on first use,
// so the new month's tab appears automatically with its first statement.
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

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = new Set(meta.data.sheets.map((s) => s.properties.title));

  for (const [month, values] of byMonth) {
    if (!titles.has(month)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: month } } }] },
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${month}'!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [spec.header] },
      });
      titles.add(month);
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${month}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }
}

module.exports = { appendRows };
