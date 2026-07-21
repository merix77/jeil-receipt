const pool = require('../config/db');
const { extractReceiptItems } = require('../services/ocrService');
const { appendPurchaseRows } = require('../services/sheetsService');
const { toDateStr } = require('../utils/date');

// Same statement re-photographed = every extracted item's (trade_date, trace_number)
// pair already exists. Items without a readable trace_number can't be matched, so a
// receipt where none was read always passes.
async function isDuplicateReceipt(items) {
  const pairs = [
    ...new Map(
      items
        .filter((it) => it.trade_date && it.trace_number)
        .map((it) => [`${it.trade_date}|${it.trace_number}`, [it.trade_date, it.trace_number]])
    ).values(),
  ];
  if (pairs.length === 0) return false;

  const placeholders = pairs.map((_, i) => `($${i * 2 + 1}::date, $${i * 2 + 2})`).join(', ');
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT (ri.trade_date, ri.trace_number)) AS n
     FROM receipt_items ri
     JOIN receipts r ON r.id = ri.receipt_id
     WHERE r.is_deleted = FALSE AND ri.is_deleted = FALSE
       AND (ri.trade_date, ri.trace_number) IN (${placeholders})`,
    pairs.flat()
  );
  return Number(rows[0].n) === pairs.length;
}

const ITEM_COLUMNS = [
  'receipt_id', 'trade_date', 'meat_type', 'weight_kg', 'origin', 'cut_name',
  'grade', 'slaughterhouse', 'trace_number', 'supplier', 'is_uncertain', 'uncertain_fields',
];

async function createReceipt(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'image file is required', code: 'MISSING_IMAGE' });
  }

  const imageUrl = req.file.path;

  // OCR and validation run before any DB write, so failures leave nothing to clean up.
  let items;
  try {
    items = await extractReceiptItems(imageUrl);
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

  if (await isDuplicateReceipt(items)) {
    return res.status(409).json({
      success: false,
      error: '이미 등록된 거래명세서입니다 (같은 거래일자·이력번호의 항목이 모두 존재).',
      code: 'DUPLICATE_RECEIPT',
    });
  }

  const { rows: [receipt] } = await pool.query(
    'INSERT INTO receipts (image_url, ocr_raw_json) VALUES ($1, $2) RETURNING *',
    [imageUrl, JSON.stringify(items)]
  );

  const params = [];
  const valuesSql = items
    .map((item, i) => {
      // trade_date is NOT NULL; OCR returns "" when unreadable, so fall back to
      // today and flag the item as uncertain rather than failing the insert.
      const uncertainFields = [];
      let tradeDate = item.trade_date;
      if (!tradeDate) {
        tradeDate = toDateStr(new Date());
        uncertainFields.push('trade_date');
      }

      params.push(
        receipt.id, tradeDate, item.meat_type, item.weight_kg || null, item.origin,
        item.cut_name, item.grade, item.slaughterhouse, item.trace_number, item.supplier,
        uncertainFields.length > 0, uncertainFields
      );
      const base = i * ITEM_COLUMNS.length;
      return `(${ITEM_COLUMNS.map((_, j) => `$${base + j + 1}`).join(', ')})`;
    })
    .join(', ');

  const { rows: insertedItems } = await pool.query(
    `INSERT INTO receipt_items (${ITEM_COLUMNS.join(', ')}) VALUES ${valuesSql} RETURNING *`,
    params
  );

  res.json({ success: true, data: { receipt, items: insertedItems }, message: 'OCR extraction complete' });
}

async function updateReceiptItems(req, res) {
  const { id } = req.params;
  const { items } = req.body;

  const updated = [];
  for (const item of items) {
    const { rows: [row] } = await pool.query(
      `UPDATE receipt_items SET
        trade_date = $1, meat_type = $2, weight_kg = $3, origin = $4, cut_name = $5,
        grade = $6, slaughterhouse = $7, trace_number = $8, supplier = $9, updated_at = NOW()
       WHERE id = $10 AND receipt_id = $11
       RETURNING *`,
      [
        item.trade_date, item.meat_type, item.weight_kg, item.origin, item.cut_name,
        item.grade, item.slaughterhouse, item.trace_number, item.supplier,
        item.id, id,
      ]
    );
    updated.push(row);
  }

  res.json({ success: true, data: { items: updated }, message: 'Items updated' });
}

async function confirmReceipt(req, res) {
  const { id } = req.params;

  const { rows: items } = await pool.query(
    'SELECT * FROM receipt_items WHERE receipt_id = $1 AND is_deleted = FALSE ORDER BY trade_date',
    [id]
  );

  try {
    await appendPurchaseRows(items);
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
    `SELECT r.id, r.created_at, r.image_url, r.sheet_synced, r.sheet_synced_at, r.sync_error,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ri.id, 'trade_date', ri.trade_date, 'meat_type', ri.meat_type,
                  'weight_kg', ri.weight_kg, 'origin', ri.origin, 'cut_name', ri.cut_name,
                  'grade', ri.grade, 'slaughterhouse', ri.slaughterhouse,
                  'trace_number', ri.trace_number, 'supplier', ri.supplier
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
