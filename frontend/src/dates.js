// Single date convention for the frontend: the user's local time (KST).
// created_at from the server is UTC ISO — always convert via localDateStr
// before comparing to "today", or morning records land on yesterday's date.
export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const todayStr = () => toDateStr(new Date());
export const monthStr = (d) => toDateStr(d).slice(0, 7);
export const localDateStr = (iso) => toDateStr(new Date(iso));
