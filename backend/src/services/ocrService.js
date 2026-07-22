const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 첫 모델의 무료 할당량이 소진되면 뒤 모델로 자동 대체 (할당량은 모델별로 잡힘).
// GEMINI_MODEL로 우선 모델을 바꿀 수 있음.
const MODELS = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-flash-latest'];

// 판매분은 세금계산서를 촬영해 영업자간 거래내역서(판매) 시트에 기록한다.
// 우리(제일축산)가 공급자이므로 '판매처'는 공급받는자 상호.
const SALE_PROMPT = `다음은 세금계산서 사진입니다. 판매 기록에 필요한 항목만 추출하세요.
아래 JSON 배열 형식으로만 응답하세요. 설명, 코드블록 표시, 다른 텍스트는 절대 포함하지 마세요.

[
  {
    "trade_date": "YYYY-MM-DD",
    "supplier": "공급받는자의 상호(법인명)",
    "cut_name": "품목",
    "weight_kg": "수량 숫자 문자열",
    "note": "비고란 내용"
  }
]

규칙:
- "trade_date"는 상단 '작성' 년월일(작성일자)을 YYYY-MM-DD로 변환해 넣으세요.
  품목 행에 적힌 월·일이 아니라 작성일자를 사용합니다. 모든 항목이 같은 작성일자를 가집니다.
- "supplier"에는 반드시 **공급받는자(구매자)** 쪽 상호를 넣으세요. 공급자(판매자) 상호가 아닙니다.
- 하단 품목 표의 각 행(월/일/품목/규격/수량/단가/공급가액/세액/비고)이 한 항목 = 한 행
- 품목이 비어있는 행은 제외하고, 실제로 기재된 행만 추출
- 금액(단가·공급가액·세액·합계금액)은 추출하지 마세요
- 값을 찾을 수 없으면 빈 문자열("")
- 읽기 어려운 글자는 추정값 뒤에 "?" 표시
- 반드시 유효한 JSON 배열만 응답`;

const EXTRACTION_PROMPT = `다음은 축산물 거래명세서(또는 거래내역서) 사진입니다.
아래 JSON 배열 형식으로만 응답하세요. 설명, 코드블록 표시, 다른 텍스트는 절대 포함하지 마세요.

[
  {
    "trade_date": "YYYY-MM-DD",
    "meat_type": "한우 또는 육우 등 축종",
    "weight_kg": "숫자 문자열",
    "origin": "",
    "cut_name": "안심, 등심 등 부위",
    "grade": "1++, 2 등 등급 표기",
    "slaughterhouse": "",
    "trace_number": "",
    "supplier": "공급자(매도인) 상호"
  }
]

규칙:
- 품목란이 합쳐져 있으면 축종/부위/등급을 각각의 필드로 분리
- 한 품목 = 한 행
- 값을 찾을 수 없으면 빈 문자열("")
- 읽기 어려운 글자는 추정값 뒤에 "?" 표시
- 반드시 유효한 JSON 배열만 응답`;

function mediaTypeFromExt(imagePath) {
  const ext = imagePath.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function ocrError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

// Provider-specific error semantics stay in this file so a future model swap
// (e.g. Gemini → Claude) only touches the OCR service.
async function extractReceiptItems(imagePath, docType = 'purchase') {
  const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

  const request = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: mediaTypeFromExt(imagePath), data: imageBase64 } },
          { text: docType === 'sale' ? SALE_PROMPT : EXTRACTION_PROMPT },
        ],
      },
    ],
    config: { responseMimeType: 'application/json' },
  };

  // 무료 티어 할당량은 모델별로 따로 잡히므로, 소진되면 다음 모델로 넘어간다.
  let response;
  for (const [i, model] of MODELS.entries()) {
    try {
      response = await genAI.models.generateContent({ model, ...request });
      if (i > 0) console.warn(`OCR: ${MODELS[0]} 할당량 소진 → ${model} 사용`);
      break;
    } catch (err) {
      const exhausted = String(err.message).includes('RESOURCE_EXHAUSTED');
      if (!exhausted) {
        console.error(err);
        throw ocrError(502, 'OCR_FAILED', 'OCR 인식에 실패했습니다. 다시 시도해주세요.');
      }
      if (i === MODELS.length - 1) {
        console.error('모든 모델의 무료 할당량 소진:', err.message);
        throw ocrError(429, 'OCR_QUOTA_EXCEEDED', '오늘의 무료 OCR 사용량을 모두 사용했습니다. 한도는 한국시간 오후 4~5시경 초기화됩니다.');
      }
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (err) {
    parsed = null;
  }
  // Gemini can legally return an object despite the array-only prompt —
  // anything but an array must fail here, not crash downstream.
  if (!Array.isArray(parsed)) {
    console.error('OCR response is not a JSON array:', response.text);
    throw ocrError(502, 'OCR_FAILED', 'OCR 응답 해석에 실패했습니다. 다시 시도해주세요.');
  }
  return parsed;
}

module.exports = { extractReceiptItems };
