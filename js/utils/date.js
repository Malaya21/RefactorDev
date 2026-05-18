/**
 * Utility Layer: local calendar date helpers.
 * Business logic can share these without depending on rendering or storage modules.
 */
const DateUtils = (() => {
  function formatDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function todayKey() {
    return formatDateKey(new Date());
  }

  function toLocalNoon(dateKey) {
    return new Date(dateKey + 'T12:00:00');
  }

  function addDays(dateKey, amount) {
    const d = toLocalNoon(dateKey);
    d.setDate(d.getDate() + amount);
    return formatDateKey(d);
  }

  function compareDateKeys(a, b) {
    return toLocalNoon(a) - toLocalNoon(b);
  }

  function getDatesBetween(startKey, endKey, { includeStart = true, includeEnd = true } = {}) {
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

  function daysBetween(startKey, endKey) {
    return getDatesBetween(startKey, endKey, { includeStart: false, includeEnd: true }).length;
  }

  function msUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight - now;
  }

  return {
    formatDateKey,
    todayKey,
    toLocalNoon,
    addDays,
    compareDateKeys,
    getDatesBetween,
    daysBetween,
    msUntilMidnight
  };
})();
