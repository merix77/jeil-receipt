const { Pool, types } = require('pg');

// DATE (oid 1082) — keep as raw "YYYY-MM-DD" string, don't let pg parse it into
// a JS Date, which would attach a timezone and shift the date by a day on serialization.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
