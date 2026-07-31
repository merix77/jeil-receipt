const { Pool, types } = require('pg');

// DATE (oid 1082) — keep as raw "YYYY-MM-DD" string, don't let pg parse it into
// a JS Date, which would attach a timezone and shift the date by a day on serialization.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // created_at uses NOW() with a TIMESTAMP column: pin the session timezone so
  // stored wall times are KST even when the DB server (e.g. Railway) runs UTC.
  options: '-c TimeZone=Asia/Seoul',
  // Neon 무료 컴퓨트는 유휴 시 정지 → 깨어나는 데 몇 초 걸릴 수 있으므로
  // 연결 시도가 즉시 실패하지 않도록 넉넉히 대기(콜드스타트 흡수).
  connectionTimeoutMillis: 15000,
});

module.exports = pool;
