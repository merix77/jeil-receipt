// 돼지 수율표 부위 정의 — 순서 고정(1~12). 백엔드 config/yieldParts.js와 동일하게 유지.
export const FIXED_PART_REVENUE = 5000; // 등뼈·미니족: 입력 없이 고정 매출액

// marginIncluded=true(1~10)만 총매출액에 합산. 등뼈·미니족(11~12)은 고정 5,000원, 합산 제외.
export const YIELD_PARTS = [
  { order: 1, name: '삼겹', marginIncluded: true },
  { order: 2, name: '목살', marginIncluded: true },
  { order: 3, name: '갈비', marginIncluded: true },
  { order: 4, name: '앞다리살', marginIncluded: true },
  { order: 5, name: '뒷다리살', marginIncluded: true },
  { order: 6, name: '등심', marginIncluded: true },
  { order: 7, name: '안심', marginIncluded: true },
  { order: 8, name: '항정살', marginIncluded: true },
  { order: 9, name: '가브리살', marginIncluded: true },
  { order: 10, name: '갈매기살', marginIncluded: true },
  { order: 11, name: '등뼈', marginIncluded: false, fixedRevenue: FIXED_PART_REVENUE },
  { order: 12, name: '미니족', marginIncluded: false, fixedRevenue: FIXED_PART_REVENUE },
];
