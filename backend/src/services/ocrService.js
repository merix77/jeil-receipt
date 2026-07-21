const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

async function extractReceiptItems(imagePath) {
  const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: mediaTypeFromExt(imagePath), data: imageBase64 } },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
}

module.exports = { extractReceiptItems };
