export function formatDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return formatDateKey(new Date());
}

export function toLocalNoon(dateKey) {
  return new Date(`${dateKey}T12:00:00`);
}

export function addDays(dateKey, amount) {
  const d = toLocalNoon(dateKey);
  d.setDate(d.getDate() + amount);
  return formatDateKey(d);
}

export function compareDateKeys(a, b) {
  return toLocalNoon(a) - toLocalNoon(b);
}

export function getDatesBetween(startKey, endKey, { includeStart = true, includeEnd = true } = {}) {
  if (!startKey || !endKey) return [];
  const start = includeStart ? startKey : addDays(startKey, 1);
  const end = includeEnd ? endKey : addDays(endKey, -1);
  if (compareDateKeys(start, end) > 0) return [];

  const dates = [];
  let cursor = start;
  while (compareDateKeys(cursor, end) <= 0) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function daysBetween(startKey, endKey) {
  return getDatesBetween(startKey, endKey, { includeStart: false, includeEnd: true }).length;
}

export function startOfWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return formatDateKey(d);
}

export function getWeekRange(date = new Date()) {
  const start = startOfWeekKey(date);
  const end = addDays(start, 6);
  return { start, end, weekKey: start };
}

export function getCurrentWeekDates(date = new Date()) {
  const { start, end } = getWeekRange(date);
  return getDatesBetween(start, end);
}

export function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}
