// 돼지 수율표 부위 정의 — 순서 고정(1~12). 소 수율표 추가 시 재사용 고려해 분리.
const FIXED_PART_REVENUE = 5000; // 등뼈·미니족: 입력 없이 고정 매출액

// marginIncluded=true 부위만 총매출액에 합산(1~10). 등뼈·미니족(11~12)은 시트 기록만.
// 가브리살 등은 발골 시 안 나올 수 있으나 별도 처리 없음 — 미입력 시 공란.
const YIELD_PARTS = [
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

module.exports = { YIELD_PARTS, FIXED_PART_REVENUE };
