const pool = require('../config/db');
const { computeYield } = require('../services/yieldCalc');
const { YIELD_PARTS } = require('../config/yieldParts');
const { todayStr } = require('../utils/date');

const MARGIN_PART_NAMES = new Set(YIELD_PARTS.filter((p) => p.marginIncluded).map((p) => p.name));

async function createYield(req, res) {
  const { measured_date, price_per_kg, total_weight_kg, total_purchase_price, parts } = req.body;

  const date = measured_date || todayStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: '날짜는 YYYY-MM-DD 형식이어야 합니다', code: 'INVALID_DATE' });
  }
  if (!Number.isFinite(Number(total_purchase_price)) || Number(total_purchase_price) < 0) {
    return res.status(400).json({ success: false, error: '총매입가를 0 이상의 숫자로 입력해주세요', code: 'INVALID_PURCHASE_PRICE' });
  }
  // 마진 대상 7부위 외 이름이 오면 거부(등뼈·미니족은 서버가 고정값으로 채움)
  for (const p of parts || []) {
    if (!MARGIN_PART_NAMES.has(p.part_name)) {
      return res.status(400).json({ success: false, error: `입력할 수 없는 부위입니다: ${p.part_name}`, code: 'INVALID_PART' });
    }
  }

  const { parts: computedParts, totalRevenue, marginAmount, marginRate } = computeYield({
    totalPurchasePrice: total_purchase_price,
    enteredParts: parts,
  });

  // 같은 날짜 기존 건 여부 — 등록은 막지 않고 플래그만 응답에 담아 UI가 안내
  const { rows: dup } = await pool.query(
    'SELECT 1 FROM yield_measurements WHERE is_deleted = FALSE AND measured_date = $1 LIMIT 1',
    [date]
  );
  const sameDateExists = dup.length > 0;

  const client = await pool.connect();
  let measurement;
  try {
    await client.query('BEGIN');

    ({ rows: [measurement] } = await client.query(
      `INSERT INTO yield_measurements
        (measured_date, price_per_kg, total_weight_kg, total_purchase_price,
         total_revenue, margin_amount, margin_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        date,
        numOrNull(price_per_kg),
        numOrNull(total_weight_kg),
        Number(total_purchase_price),
        totalRevenue,
        marginAmount,
        marginRate,
      ]
    ));

    const params = [];
    const valuesSql = computedParts
      .map((p, i) => {
        const b = i * 7;
        params.push(measurement.id, p.part_order, p.part_name, p.weight_kg, p.unit_price, p.revenue, p.margin_included);
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
      })
      .join(', ');

    const { rows: insertedParts } = await client.query(
      `INSERT INTO yield_parts
        (measurement_id, part_order, part_name, weight_kg, unit_price, revenue, margin_included)
       VALUES ${valuesSql} RETURNING *`,
      params
    );

    await client.query('COMMIT');
    measurement.parts = insertedParts;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({
    success: true,
    data: { measurement, same_date_exists: sameDateExists },
    message: '수율 측정이 저장되었습니다',
  });
}

async function listYields(req, res) {
  const { month } = req.query; // optional "YYYY-MM"
  const params = [];
  let where = 'is_deleted = FALSE';
  if (month) {
    params.push(month);
    where += ` AND to_char(measured_date, 'YYYY-MM') = $1`;
  }

  const { rows } = await pool.query(
    `SELECT * FROM yield_measurements WHERE ${where} ORDER BY measured_date DESC, id DESC`,
    params
  );

  res.json({ success: true, data: rows, message: 'OK' });
}

async function getYield(req, res) {
  const { id } = req.params;

  const { rows: [measurement] } = await pool.query(
    'SELECT * FROM yield_measurements WHERE id = $1 AND is_deleted = FALSE',
    [id]
  );
  if (!measurement) {
    return res.status(404).json({ success: false, error: '해당 수율 측정을 찾을 수 없습니다', code: 'NOT_FOUND' });
  }

  const { rows: parts } = await pool.query(
    'SELECT * FROM yield_parts WHERE measurement_id = $1 ORDER BY part_order',
    [id]
  );
  measurement.parts = parts;

  res.json({ success: true, data: measurement, message: 'OK' });
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

module.exports = { createYield, listYields, getYield };
