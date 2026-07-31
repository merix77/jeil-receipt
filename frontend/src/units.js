// 1근 = 600g = 0.6kg. 정육점은 근 단위 판매가 주력이라 kg 단가와 함께 근 단가를 병기한다.
export const GRAM_PER_GEUN = 600;
const KG_PER_GEUN = GRAM_PER_GEUN / 1000; // 0.6

// kg 단가 → "1근(600g) 9,000원" 라벨. 값이 없거나 0 이하면 null(표시 안 함). 원 단위 반올림.
export function geunPriceLabel(pricePerKg) {
  const p = Number(pricePerKg);
  if (!Number.isFinite(p) || p <= 0) return null;
  return `1근(${GRAM_PER_GEUN}g) ${Math.round(p * KG_PER_GEUN).toLocaleString()}원`;
}
