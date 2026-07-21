const sheets = require('../config/google');
const { monthStr } = require('../utils/date');
const { INSPECTOR_NAME } = require('../config/business');

const TEMPLATE_TITLE = '위생점검표';
const ITEM_START_ROW = 6; // rows 6..21 = 16 inspection items
const ITEM_END_ROW = 21;
const ITEM_COUNT = ITEM_END_ROW - ITEM_START_ROW + 1;
const DAY_START_COL = 3; // column C = day 1

function columnLetter(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function ensureMonthTab(spreadsheetId, sheetList, title, year, month) {
  if (sheetList.some((s) => s.properties.title === title)) return;

  const template = sheetList.find((s) => s.properties.title === TEMPLATE_TITLE);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { duplicateSheet: { sourceSheetId: template.properties.sheetId, newSheetName: title } },
      ],
    },
  });
  // C2 is one merged cell spanning C..AG, so the inspector name goes inside it with the label.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!B2:C2`,
    valueInputOption: 'RAW',
    requestBody: { values: [[`${year}년 ${month}월`, `점검자 : ${INSPECTOR_NAME}`]] },
  });
}

// Fills every day column (1..lastDay) that has no marks at all with 'O' for all 16 items.
// Columns where the user already wrote anything (O/△/X on any row) are left untouched.
async function fillEmptyDays(spreadsheetId, title, lastDay) {
  const grid = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!C${ITEM_START_ROW}:AG${ITEM_END_ROW}`,
  });
  const rows = grid.data.values || [];

  const filledDays = [];
  const data = [];
  for (let day = 1; day <= lastDay; day++) {
    const colIdx = day - 1;
    const hasAnyMark = rows.some((row) => (row[colIdx] || '').trim() !== '');
    if (hasAnyMark) continue;

    const col = columnLetter(DAY_START_COL + day - 1);
    data.push({
      range: `'${title}'!${col}${ITEM_START_ROW}:${col}${ITEM_END_ROW}`,
      values: Array.from({ length: ITEM_COUNT }, () => ['O']),
    });
    filledDays.push(day);
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }
  return filledDays;
}

// Marks today and back-fills any fully-unmarked earlier days: the whole current
// month up to today, plus the tail of the previous month's tab if one exists.
async function markHygieneChecks() {
  const spreadsheetId = process.env.SHEET_ID_HYGIENE_CHECK;
  const now = new Date();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets;
  const existingTitles = sheetList.map((s) => s.properties.title);

  const result = [];

  // Previous month: only complete a tab that already exists (don't invent history).
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevTitle = monthStr(prev);
  if (existingTitles.includes(prevTitle)) {
    const prevLastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
    const filled = await fillEmptyDays(spreadsheetId, prevTitle, prevLastDay);
    if (filled.length > 0) result.push({ month: prevTitle, days: filled });
  }

  const title = monthStr(now);
  await ensureMonthTab(spreadsheetId, sheetList, title, now.getFullYear(), now.getMonth() + 1);
  const filled = await fillEmptyDays(spreadsheetId, title, now.getDate());
  if (filled.length > 0) result.push({ month: title, days: filled });

  return result;
}

module.exports = { markHygieneChecks };
