const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { markHygieneChecks } = require('../services/hygieneService');
const { registerEducation } = require('../services/educationService');

const router = express.Router();

router.post('/check', asyncHandler(async (req, res) => {
  const result = await markHygieneChecks();
  const totalDays = result.reduce((sum, r) => sum + r.days.length, 0);

  const message = totalDays === 0
    ? '오늘까지 모두 등록되어 있습니다'
    : result
        .map((r) => `${r.month}: ${r.days.length}일 등록 (${r.days.join(', ')}일)`)
        .join(' / ');

  res.json({ success: true, data: result, message });
}));

router.post('/education', asyncHandler(async (req, res) => {
  const result = await registerEducation();
  const message = result.alreadyDone
    ? '오늘 교육 결과서는 이미 등록되어 있습니다'
    : result.dates.length === 1
      ? `${result.dates[0]} 교육 결과서 등록 완료`
      : `${result.dates.length}일치 등록 완료 (${result.dates[0]} ~ ${result.dates[result.dates.length - 1]})`;

  res.json({ success: true, data: result, message });
}));

module.exports = router;
