// 항목 필드의 단일 정의 — 확인 화면과 조회 화면이 함께 사용
const PURCHASE_FIELDS = [
  { key: 'trade_date', label: '거래년월일' },
  { key: 'meat_type', label: '축종' },
  { key: 'weight_kg', label: '물량(kg)' },
  { key: 'origin', label: '원산지' },
  { key: 'cut_name', label: '부위명칭' },
  { key: 'grade', label: '등급' },
  { key: 'slaughterhouse', label: '도축장명' },
  { key: 'trace_number', label: '이력번호' },
  { key: 'supplier', label: '매입처' },
];

// 판매분은 시트 컬럼이 5개뿐 — 매입 컬럼에 대응해 저장됨
const SALE_FIELDS = [
  { key: 'trade_date', label: '판매년월일' },
  { key: 'supplier', label: '판매처' },
  { key: 'cut_name', label: '판매부위' },
  { key: 'weight_kg', label: '판매량' },
  { key: 'note', label: '비고' },
];

export const fieldsFor = (docType) => (docType === 'sale' ? SALE_FIELDS : PURCHASE_FIELDS);
export const docTypeLabel = (docType) => (docType === 'sale' ? '판매분' : '매입분');
