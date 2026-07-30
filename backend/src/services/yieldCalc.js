const { YIELD_PARTS } = require('../config/yieldParts');

// 파생값 재계산 규칙 (단일 출처)
// -----------------------------------------------------------------------------
// total_revenue / margin_amount / margin_rate 는 yield_parts 에서 파생된 값이다.
// 부위 데이터가 바뀌면 이 함수로 세 값을 반드시 다시 계산해, 마스터 업데이트를
// **같은 트랜잭션 안에서** 함께 수행해야 한다. 한쪽만 바뀌면 요약 탭과 상세 탭이
// 어긋난다. (지금은 등록 시 1회 호출, 추후 부위 수정 API에서도 이 함수를 재사용)
//
// 입력: 사용자가 입력한 부위(마진 대상 7종)의 { part_name -> {weight_kg, unit_price} }
//       + 총매입가
// 출력: DB에 그대로 넣을 canonical 12행(parts) + 파생 3값
function computeYield({ totalPurchasePrice, enteredParts }) {
  const byName = new Map();
  for (const p of enteredParts || []) byName.set(p.part_name, p);

  const parts = YIELD_PARTS.map((def) => {
    if (!def.marginIncluded) {
      // 등뼈·미니족: 입력 없이 고정 매출액
      return {
        part_order: def.order,
        part_name: def.name,
        weight_kg: null,
        unit_price: null,
        revenue: def.fixedRevenue,
        margin_included: false,
      };
    }
    const input = byName.get(def.name);
    const weight = toNum(input && input.weight_kg);
    const price = toNum(input && input.unit_price);
    // 둘 다 있어야 매출액 성립. 하나라도 없으면 미입력 → revenue NULL(합산 제외)
    const revenue = weight != null && price != null ? round2(weight * price) : null;
    return {
      part_order: def.order,
      part_name: def.name,
      weight_kg: weight,
      unit_price: price,
      revenue,
      margin_included: true,
    };
  });

  // 총매출액 = 마진 포함 부위 중 매출액이 있는 것만 합산 (등뼈·미니족 제외)
  const totalRevenue = round2(
    parts
      .filter((p) => p.margin_included && p.revenue != null)
      .reduce((sum, p) => sum + p.revenue, 0)
  );

  const purchase = toNum(totalPurchasePrice) ?? 0;
  const marginAmount = round2(totalRevenue - purchase);
  // 0으로 나누기 방지: 총매입가 0이면 마진율 0
  const marginRate = purchase > 0 ? round1((marginAmount / purchase) * 100) : 0;

  return { parts, totalRevenue, marginAmount, marginRate };
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

module.exports = { computeYield };
