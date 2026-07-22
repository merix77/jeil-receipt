const pool = require('../config/db');
const { extractReceiptItems } = require('../services/ocrService');
const { appendRows } = require('../services/sheetsService');
const { todayStr } = require('../utils/date');

// The OCR prompt tells Gemini to mark unreadable guesses with a trailing "?".
// That marker is fine in VARCHAR columns (the UI highlights it), but it must
// never reach the DATE/NUMERIC columns — normalize both here so a blurry photo
// can't crash an insert or the duplicate check.
function normalizeTypedFields(raw) {
  const uncertainFields = [];

  let tradeDate = typeof raw.trade_date === 'string' ? raw.trade_date.trim() : '';
  if (tradeDate.endsWith('?')) {
    tradeDate = tradeDate.slice(0, -1).trim();
    uncertainFields.push('trade_date');
  }
  const m = tradeDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  tradeDate = m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
  if (!tradeDate) {
    tradeDate = todayStr();
    if (!uncertainFields.includes('trade_date')) uncertainFields.push('trade_date');
  }

  let weightRaw = typeof raw.weight_kg === 'string' ? raw.weight_kg.trim() : raw.weight_kg;
  if (typeof weightRaw === 'string' && weightRaw.endsWith('?')) {
    weightRaw = weightRaw.slice(0, -1).trim();
    uncertainFields.push('weight_kg');
  }
  const parsed = Number(weightRaw);
  const weight = weightRaw !== '' && weightRaw != null && Number.isFinite(parsed) ? parsed : null;
  if (weight === null && raw.weight_kg && !uncertainFields.includes('weight_kg')) {
    uncertainFields.push('weight_kg');
  }

  return { tradeDate, weight, uncertainFields };
}

// Same statement re-photographed = every extracted item already exists.
// Purchases match on (trade_date, trace_number) — the legally unique pair.
// Sales have no such identifier, so they match on (trade_date, supplier, cut_name, weight).
// Items lacking the identifying values can't be matched, so a receipt where none
// were read always passes.
async function isDuplicateReceipt(docType, items) {
  const isSale = docType === 'sale';
  const cols = isSale
    ? ['trade_date', 'supplier', 'cut_name', 'weight_kg']
    : ['trade_date', 'trace_number'];
  const casts = isSale ? ['::date', '', '', '::numeric'] : ['::date', ''];

  const keyed = items
    .filter((it) => (isSale ? it.supplier && it.cut_name && it.weight != null : it.trace_number))
    .map((it) =>
      isSale
        ? [it.tradeDate, it.supplier, it.cut_name, it.weight]
        : [it.tradeDate, it.trace_number]
    );
  const rowsToCheck = [...new Map(keyed.map((v) => [v.join('|'), v])).values()];
  if (rowsToCheck.length === 0) return false;

  const placeholders = rowsToCheck
    .map((_, i) => `(${cols.map((_, j) => `$${i * cols.length + j + 1}${casts[j]}`).join(', ')})`)
    .join(', ');

  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT (${cols.map((c) => `ri.${c}`).join(', ')})) AS n
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     WHERE r.is_deleted = FALSE AND ri.is_deleted = FALSE AND r.doc_type = $${rowsToCheck.length * cols.length + 1}
       AND (${cols.map((c) => `ri.${c}`).join(', ')}) IN (${placeholders})`,
    [...rowsToCheck.flat(), docType]
  );
  return Number(rows[0].n) === rowsToCheck.length;
}

const ITEM_COLUMNS = [
  'receipt_id', 'trade_date', 'meat_type', 'weight_kg', 'origin', 'cut_name',
  'grade', 'slaughterhouse', 'trace_number', 'supplier', 'note', 'is_uncertain', 'uncertain_fields',
];

async function createReceipt(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'image file is required', code: 'MISSING_IMAGE' });
  }

  const docType = req.body.doc_type === 'sale' ? 'sale' : 'purchase';
  const imageUrl = req.file.path;

  // OCR and validation run before any DB write, so failures leave nothing to clean up.
  let items;
  try {
    items = await extractReceiptItems(imageUrl, docType);
  } catch (err) {
    return res.status(err.status || 502).json({ success: false, error: err.message, code: err.code || 'OCR_FAILED' });
  }

  if (items.length === 0) {
    return res.status(422).json({
      success: false,
      error: '사진에서 거래 항목을 찾지 못했습니다. 다시 촬영해주세요.',
      code: 'OCR_EMPTY',
    });
  }

  const normalized = items.map((item) => ({ ...item, ...normalizeTypedFields(item) }));

  if (await isDuplicateReceipt(docType, normalized)) {
    return res.status(409).json({
      success: false,
      error: docType === 'sale'
        ? '이미 등록된 판매 내역서입니다 (같은 판매일자·판매처·부위·판매량의 항목이 모두 존재).'
        : '이미 등록된 거래명세서입니다 (같은 거래일자·이력번호의 항목이 모두 존재).',
      code: 'DUPLICATE_RECEIPT',
    });
  }

  // Both inserts in one transaction: a failure (e.g. a VARCHAR overflow from a
  // garbled OCR value) must not leave an item-less receipt row behind.
  const client = await pool.connect();
  let receipt, insertedItems;
  try {
    await client.query('BEGIN');

    ({ rows: [receipt] } = await client.query(
      'INSERT INTO receipts (doc_type, image_url, ocr_raw_json) VALUES ($1, $2, $3) RETURNING *',
      [docType, imageUrl, JSON.stringify(items)]
    ));

    const params = [];
    const valuesSql = normalized
      .map((item, i) => {
        params.push(
          receipt.id, item.tradeDate, item.meat_type, item.weight, item.origin,
          item.cut_name, item.grade, item.slaughterhouse, item.trace_number, item.supplier,
          item.note, item.uncertainFields.length > 0, item.uncertainFields
        );
        const base = i * ITEM_COLUMNS.length;
        return `(${ITEM_COLUMNS.map((_, j) => `$${base + j + 1}`).join(', ')})`;
      })
      .join(', ');

    ({ rows: insertedItems } = await client.query(
      `INSERT INTO receipt_items (${ITEM_COLUMNS.join(', ')}) VALUES ${valuesSql} RETURNING *`,
      params
    ));

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ success: true, data: { receipt, items: insertedItems }, message: 'OCR extraction complete' });
}

async function updateReceiptItems(req, res) {
  const { id } = req.params;
  const { items } = req.body;

  // User-edited values are free text — validate the typed columns up front so a
  // typo returns a clear 400 instead of a DB cast error.
  for (const item of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.trade_date || '')) {
      return res.status(400).json({
        success: false,
        error: `거래년월일은 YYYY-MM-DD 형식으로 입력해주세요 (입력값: "${item.trade_date}")`,
        code: 'INVALID_TRADE_DATE',
      });
    }
    if (item.weight_kg !== null && item.weight_kg !== '' && !Number.isFinite(Number(item.weight_kg))) {
      return res.status(400).json({
        success: false,
        error: `물량(kg)은 숫자로 입력해주세요 (입력값: "${item.weight_kg}")`,
        code: 'INVALID_WEIGHT',
      });
    }
  }

  const updated = [];
  for (const item of items) {
    // The user has reviewed this item, so the uncertainty flags are cleared.
    const { rows: [row] } = await pool.query(
      `UPDATE receipt_items SET
        trade_date = $1, meat_type = $2, weight_kg = $3, origin = $4, cut_name = $5,
        grade = $6, slaughterhouse = $7, trace_number = $8, supplier = $9, note = $10,
        is_uncertain = FALSE, uncertain_fields = NULL, updated_at = NOW()
       WHERE id = $11 AND receipt_id = $12
       RETURNING *`,
      [
        item.trade_date, item.meat_type, item.weight_kg === '' ? null : item.weight_kg,
        item.origin, item.cut_name,
        item.grade, item.slaughterhouse, item.trace_number, item.supplier, item.note,
        item.id, id,
      ]
    );
    if (row) updated.push(row);
  }

  res.json({ success: true, data: { items: updated }, message: 'Items updated' });
}

async function confirmReceipt(req, res) {
  const { id } = req.params;

  const { rows: [receipt] } = await pool.query(
    'SELECT id, doc_type, sheet_synced FROM receipts WHERE id = $1 AND is_deleted = FALSE',
    [id]
  );
  if (!receipt) {
    return res.status(404).json({ success: false, error: '해당 영수증을 찾을 수 없습니다', code: 'NOT_FOUND' });
  }
  // Double-tap / client retry must not append the same rows to the ledger twice.
  if (receipt.sheet_synced) {
    return res.json({ success: true, data: { receiptId: id }, message: '이미 시트에 반영된 건입니다' });
  }

  const { rows: items } = await pool.query(
    'SELECT * FROM receipt_items WHERE receipt_id = $1 AND is_deleted = FALSE ORDER BY trade_date',
    [id]
  );
  if (items.length === 0) {
    return res.status(422).json({ success: false, error: '기록할 항목이 없습니다', code: 'NO_ITEMS' });
  }

  try {
    await appendRows(receipt.doc_type, items);
    await pool.query(
      'UPDATE receipts SET sheet_synced = TRUE, sheet_synced_at = NOW(), sync_error = NULL WHERE id = $1',
      [id]
    );
  } catch (err) {
    console.error(err);
    await pool.query('UPDATE receipts SET sync_error = $1 WHERE id = $2', [err.message, id]);
    return res.status(502).json({ success: false, error: 'Google Sheets sync failed', code: 'SYNC_FAILED' });
  }

  res.json({ success: true, data: { receiptId: id }, message: 'Synced to Google Sheets' });
}

async function listReceipts(req, res) {
  const { month } = req.query; // optional "YYYY-MM"

  const params = [];
  let where = 'r.is_deleted = FALSE';
  if (month) {
    params.push(month);
    where += ` AND to_char(r.created_at, 'YYYY-MM') = $1`;
  }

  const { rows } = await pool.query(
    `SELECT r.id, r.created_at, r.doc_type, r.image_url, r.sheet_synced, r.sheet_synced_at, r.sync_error,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ri.id, 'trade_date', ri.trade_date, 'meat_type', ri.meat_type,
                  'weight_kg', ri.weight_kg, 'origin', ri.origin, 'cut_name', ri.cut_name,
                  'grade', ri.grade, 'slaughterhouse', ri.slaughterhouse,
                  'trace_number', ri.trace_number, 'supplier', ri.supplier, 'note', ri.note,
                  'is_uncertain', ri.is_uncertain, 'uncertain_fields', ri.uncertain_fields
                ) ORDER BY ri.id
              ) FILTER (WHERE ri.id IS NOT NULL), '[]'
            ) AS items
     FROM receipts r
     LEFT JOIN receipt_items ri ON ri.receipt_id = r.id AND ri.is_deleted = FALSE
     WHERE ${where}
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    params
  );

  res.json({ success: true, data: rows, message: 'OK' });
}

async function getReceiptImage(req, res) {
  const { id } = req.params;

  const { rows: [receipt] } = await pool.query(
    'SELECT image_url FROM receipts WHERE id = $1 AND is_deleted = FALSE',
    [id]
  );
  if (!receipt) {
    return res.status(404).json({ success: false, error: 'Receipt not found', code: 'NOT_FOUND' });
  }

  res.sendFile(receipt.image_url);
}

module.exports = { createReceipt, updateReceiptItems, confirmReceipt, listReceipts, getReceiptImage };
