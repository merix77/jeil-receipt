// db/migrations/*.sql 을 파일명 순서대로 실행한다.
// 모든 마이그레이션은 재실행 안전(IF NOT EXISTS 등)해야 하며, 여기서 별도 이력 테이블은 두지 않는다.
// 실행: npm run migrate  (DATABASE_URL 사용)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Neon 무료 컴퓨트 콜드스타트 대응: DB가 깨어날 때까지 연결을 재시도한다.
// 일시적 콜드스타트로 서버가 못 뜨는 일을 막되, 계속 실패하면 exit 1(fail-closed 유지).
async function waitForDb(retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      if (attempt > 1) console.log(`[migrate] DB 연결 성공 (시도 ${attempt}/${retries})`);
      return;
    } catch (err) {
      console.warn(`[migrate] DB 연결 시도 ${attempt}/${retries} 실패: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

async function migrate() {
  await waitForDb();

  const dir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`[migrate] ${files.length}개 파일 적용 시작`);
  for (const f of files) {
    process.stdout.write(`[migrate] ${f} ... `);
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    console.log('ok');
  }
  console.log('[migrate] 완료');
}

migrate()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[migrate] 실패:', err.message);
    await pool.end().catch(() => {});
    process.exit(1); // 실패 시 non-zero → Start Command의 && 에서 서버 기동 중단
  });
