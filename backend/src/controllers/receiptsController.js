const pool = require('../config/db');
const { extractReceiptItems } = require('../services/ocrService');
const { appendPurchaseRows } = require('../services/sheetsService');

// Same statement re-photographed = every extracted item's (trade_date, trace_number)
// pair already exists. Items without a readable trace_number can't be matched, so a
// receipt where none was read always passes.
async function isDuplicateReceipt(items) {
  const checkable = items.filter((it) => it.trade_date && it.trace_number);
  if (checkable.length === 0) return false;

  for (const it of checkable) {
    const { rows } = await pool.query(
      `SELECT 1 FROM receipt_items ri
       JOIN receipts r ON r.id = ri.receipt_id
       WHERE r.is_deleted = FALSE AND ri.is_deleted = FALSE
         AND ri.trade_date = $1 AND ri.trace_number = $2
       LIMIT 1`,
      [it.trade_date, it.trace_number]
    );
    if (rows.length === 0) return false;
  }
  return true;
}

async function createReceipt(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'image file is required', code: 'MISSING_IMAGE' });
  }

  const imageUrl = req.file.path;

  const { rows: [receipt] } = await pool.query(
    'INSERT INTO receipts (image_url) VALUES ($1) RETURNING *',
    [imageUrl]
  );

  let items;
  try {
    items = await extractReceiptItems(imageUrl);
  } catch (err) {
    console.error(err);
    await pool.query('UPDATE receipts SET is_deleted = TRUE WHERE id = $1', [receipt.id]);
    if (err.message && err.message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        success: false,
        error: '오늘의 무료 OCR 사용량(20건)을 모두 사용했습니다. 한도는 한국시간 오후 4~5시경 초기화됩니다.',
        code: 'OCR_QUOTA_EXCEEDED',
      });
    }
    return res.status(502).json({ success: false, error: 'OCR 인식에 실패했습니다. 다시 시도해주세요.', code: 'OCR_FAILED' });
  }

  await pool.query('UPDATE receipts SET ocr_raw_json = $1 WHERE id = $2', [JSON.stringify(items), receipt.id]);

  if (items.length === 0) {
    await pool.query('UPDATE receipts SET is_deleted = TRUE WHERE id = $1', [receipt.id]);
    return res.status(422).json({
      success: false,
      error: '사진에서 거래 항목을 찾지 못했습니다. 다시 촬영해주세요.',
      code: 'OCR_EMPTY',
    });
  }

  if (await isDuplicateReceipt(items)) {
    await pool.query('UPDATE receipts SET is_deleted = TRUE WHERE id = $1', [receipt.id]);
    return res.status(409).json({
      success: false,
      error: '이미 등록된 거래명세서입니다 (같은 거래일자·이력번호의 항목이 모두 존재).',
      code: 'DUPLICATE_RECEIPT',
    });
  }

  const insertedItems = [];
  for (const item of items) {
    // trade_date is NOT NULL in the schema; OCR returns "" when it couldn't read a date,
    // so fall back to today's date and flag the item as uncertain rather than crashing the insert.
    const uncertainFields = [];
    let tradeDate = item.trade_date;
    if (!tradeDate) {
      tradeDate = new Date().toISOString().slice(0, 10);
      uncertainFields.push('trade_date');
    }

    const { rows: [row] } = await pool.query(
      `INSERT INTO receipt_items
        (receipt_id, trade_date, meat_type, weight_kg, origin, cut_name, grade, slaughterhouse, trace_number, supplier, is_uncertain, uncertain_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        receipt.id,
        tradeDate,
        item.meat_type,
        item.weight_kg || null,
        item.origin,
        item.cut_name,
        item.grade,
        item.slaughterhouse,
        item.trace_number,
        item.supplier,
        uncertainFields.length > 0,
        uncertainFields,
      ]
    );
    insertedItems.push(row);
  }

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

async function getReceiptItems(req, res) {
  const { id } = req.params;

  const { rows } = await pool.query(
    'SELECT * FROM receipt_items WHERE receipt_id = $1 AND is_deleted = FALSE ORDER BY id',
    [id]
  );

  res.json({ success: true, data: { items: rows }, message: 'OK' });
}

module.exports = { createReceipt, updateReceiptItems, confirmReceipt, listReceipts, getReceiptItems, getReceiptImage };
