const express = require('express');
const upload = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const {
  createReceipt,
  updateReceiptItems,
  confirmReceipt,
  listReceipts,
  getReceiptImage,
} = require('../controllers/receiptsController');

const router = express.Router();

router.post('/', upload.single('image'), asyncHandler(createReceipt));
router.patch('/:id/items', asyncHandler(updateReceiptItems));
router.post('/:id/confirm', asyncHandler(confirmReceipt));
router.get('/', asyncHandler(listReceipts));
router.get('/:id/image', asyncHandler(getReceiptImage));

module.exports = router;
