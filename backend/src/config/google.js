const path = require('path');
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, '../../', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

module.exports = sheets;
