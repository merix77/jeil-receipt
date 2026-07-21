require('dotenv').config();

const express = require('express');
const cors = require('cors');
const requireApiKey = require('./middleware/auth');
const receiptsRouter = require('./routes/receipts');
const hygieneRouter = require('./routes/hygiene');

const app = express();

app.use(cors());
app.use(express.json());
app.use(requireApiKey);

app.use('/receipts', receiptsRouter);
app.use('/hygiene', hygieneRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
