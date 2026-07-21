const sheets = require('../config/google');

const TEMPLATE_TITLE = '위생교육결과서';

const EDUCATION_SAMPLES = [
  {
    topic: '칼·도마 등 작업도구의 세척과 소독',
    content:
      '식육과 직접 닿는 칼, 도마, 육절기는 고기 찌꺼기가 남지 않도록 사용 후 즉시 세척하고, 끓는 물 또는 소독제로 마무리 소독하는 요령을 실습했습니다. 특히 칼갈이 후 쇳가루가 남지 않도록 헹구는 과정과, 나무 도마 대신 재질별 도마를 용도에 맞게 구분해 쓰는 방법을 함께 확인했습니다.',
  },
  {
    topic: '냉장·냉동 시설의 온도 관리',
    content:
      '진열장과 냉장·냉동고의 적정 온도 기준(냉장 -2~10℃, 냉동 -18℃ 이하)을 다시 확인하고, 영업 전·중·후 온도계를 확인하는 습관을 갖도록 교육했습니다. 문을 자주 여닫을 때 온도가 올라가는 사례를 들어, 재고 정리 시간을 정해 문 여는 횟수를 줄이는 방법도 논의했습니다.',
  },
  {
    topic: '개인위생 — 올바른 손 씻기와 건강 관리',
    content:
      '작업 전, 화장실 이용 후, 외출 복귀 후 비누로 30초 이상 손을 씻는 순서를 시연했습니다. 손에 상처가 있을 때는 반드시 방수 밴드와 장갑을 착용하고, 설사·발열 등 증상이 있으면 즉시 보고 후 작업에서 제외되어야 함을 안내했습니다.',
  },
  {
    topic: '교차오염 방지를 위한 작업 구분',
    content:
      '원료육과 진열 판매육, 부산물을 다루는 도구와 용기를 분리해 사용하는 원칙을 확인했습니다. 생고기를 만진 장갑으로 포장재나 저울을 만지지 않도록 동선을 점검했고, 바닥에 떨어진 고기는 폐기하는 것을 원칙으로 재확인했습니다.',
  },
  {
    topic: '선입선출과 유통기한 관리',
    content:
      '입고 날짜별로 보관 위치를 정해 먼저 들어온 상품부터 판매하는 선입선출 원칙을 교육했습니다. 매일 개점 전 진열장 상품의 상태와 날짜를 확인하고, 의심스러운 상품은 판매하지 않고 별도 보관 후 처리하기로 했습니다.',
  },
  {
    topic: '축산물 이력번호와 표시사항 확인',
    content:
      '매입 시 거래명세서의 이력번호와 실제 상품의 이력번호가 일치하는지 확인하는 절차를 교육했습니다. 부위명, 등급, 원산지 표시를 정확하게 하는 것이 소비자 신뢰와 직결됨을 강조하고, 표시가 훼손된 경우 재부착 절차를 안내했습니다.',
  },
  {
    topic: '여름철 식중독 예방 관리',
    content:
      '기온이 높은 계절에는 상온 방치 시간을 최소화하고, 배달·포장 시 보냉재를 함께 넣는 요령을 교육했습니다. 캠필로박터, 살모넬라 등 축산물 관련 식중독균의 특징을 간단히 소개하고, 온도 관리와 손 위생이 가장 확실한 예방책임을 강조했습니다.',
  },
  {
    topic: '위생복·위생모·앞치마의 올바른 착용',
    content:
      '작업 중에는 위생복과 위생모를 항상 착용하고, 화장실이나 매장 밖으로 나갈 때는 앞치마와 장갑을 벗는 것을 원칙으로 재확인했습니다. 위생복은 주기적으로 세탁해 청결을 유지하고, 시계·반지 등 장신구는 작업 전에 빼두도록 안내했습니다.',
  },
  {
    topic: '매장 청소와 방충·방서 관리',
    content:
      '영업 종료 후 바닥과 배수구 청소, 쓰레기 처리 순서를 정리하고 구역별 청소 담당을 확인했습니다. 방충망과 포충등의 상태를 점검하고, 원료 포장 박스를 매장 안에 오래 두면 해충 유입 경로가 될 수 있어 즉시 정리하기로 했습니다.',
  },
  {
    topic: '진열장 관리와 판매 중 위생 수칙',
    content:
      '진열장 내부는 매일 닦아 청결을 유지하고, 육류 외 다른 음식물을 함께 보관하지 않는 원칙을 확인했습니다. 판매 중 흡연·음식물 섭취를 삼가고, 진열된 고기는 벽이나 바닥에 닿지 않게 배치하는 요령을 함께 점검했습니다.',
  },
];

const BACKFILL_LIMIT_DAYS = 31;
const ATTENDEES = '2명';

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function createEducationTab(spreadsheetId, templateSheetId, dateStr, sample) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { duplicateSheet: { sourceSheetId: templateSheetId, newSheetName: dateStr } },
      ],
    },
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `'${dateStr}'!B4`, values: [[dateStr]] },
        { range: `'${dateStr}'!E4`, values: [['노영곤']] },
        { range: `'${dateStr}'!B5`, values: [['제일축산']] },
        { range: `'${dateStr}'!E5`, values: [['30분~1시간']] },
        { range: `'${dateStr}'!B6`, values: [['전직원']] },
        { range: `'${dateStr}'!E6`, values: [[ATTENDEES]] },
        { range: `'${dateStr}'!B7`, values: [[sample.topic]] },
        { range: `'${dateStr}'!B8`, values: [[sample.content]] },
      ],
    },
  });
}

// Registers today's result form, back-filling one form per missed day since the
// last registered date (up to BACKFILL_LIMIT_DAYS). Topics keep rotating in order.
async function registerEducation() {
  const spreadsheetId = process.env.SHEET_ID_HYGIENE_EDU;
  const today = new Date();
  const todayStr = toDateStr(today);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const template = meta.data.sheets.find((s) => s.properties.title === TEMPLATE_TITLE);
  const dateTabs = meta.data.sheets
    .map((s) => s.properties.title)
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t))
    .sort();

  if (dateTabs.includes(todayStr)) {
    return { dates: [], alreadyDone: true };
  }

  let start;
  if (dateTabs.length === 0) {
    start = new Date(today);
  } else {
    const last = new Date(dateTabs[dateTabs.length - 1]);
    start = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (BACKFILL_LIMIT_DAYS - 1));
    if (start < limit) start = limit;
  }

  let sampleIndex = dateTabs.length;
  const registered = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = toDateStr(d);
    const sample = EDUCATION_SAMPLES[sampleIndex % EDUCATION_SAMPLES.length];
    await createEducationTab(spreadsheetId, template.properties.sheetId, dateStr, sample);
    registered.push(dateStr);
    sampleIndex++;
  }

  return { dates: registered, alreadyDone: false };
}

module.exports = { registerEducation };
