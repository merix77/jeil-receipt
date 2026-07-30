// All date logic (sheet tabs, legal trade dates, "today" checks) assumes KST.
// Railway containers default to UTC, so pin the timezone before anything loads.
process.env.TZ = process.env.TZ || 'Asia/Seoul';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const requireApiKey = require('./middleware/auth');
const receiptsRouter = require('./routes/receipts');
const hygieneRouter = require('./routes/hygiene');
const yieldsRouter = require('./routes/yields');

const app = express();

app.use(cors());
app.use(express.json());
app.use(requireApiKey);

app.use('/receipts', receiptsRouter);
app.use('/hygiene', hygieneRouter);
app.use('/yields', yieldsRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.status ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
