const path = require('path');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// 배포 환경(Render 등)은 키 파일을 둘 수 없어 JSON 전체를 환경변수로 받는다.
// 로컬은 기존대로 파일 경로 방식을 계속 쓸 수 있게 둘 다 지원.
function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (raw && raw.trim()) {
    let credentials;
    try {
      credentials = JSON.parse(raw);
    } catch (err) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON이 올바른 JSON이 아닙니다: ' + err.message);
    }
    // 대시보드에 붙여넣는 과정에서 개행이 문자 그대로("\n") 남는 경우가 흔하다.
    if (credentials.private_key && credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_SERVICE_ACCOUNT_KEY_PATH 중 하나는 설정해야 합니다');
  }
  return new google.auth.GoogleAuth({
    keyFile: path.resolve(__dirname, '../../', keyPath),
    scopes: SCOPES,
  });
}

const sheets = google.sheets({ version: 'v4', auth: buildAuth() });

module.exports = sheets;
