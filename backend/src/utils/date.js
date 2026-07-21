// Single date convention for the whole backend: server-local time (KST),
// since sheet tabs and legal records are KST-based. Never use toISOString for dates.
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayStr = () => toDateStr(new Date());
const monthStr = (d) => toDateStr(d).slice(0, 7);

module.exports = { toDateStr, todayStr, monthStr };
