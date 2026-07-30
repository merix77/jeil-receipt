const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { createYield, listYields, getYield } = require('../controllers/yieldsController');

const router = express.Router();

router.post('/', asyncHandler(createYield));
router.get('/', asyncHandler(listYields));
router.get('/:id', asyncHandler(getYield));

module.exports = router;
