/**
 * daily.js - Midnight rollover, multi-day archives, and fresh "today" state.
 */
const Daily = (() => {
  let midnightTimer = null;
  let pollTimer = null;
  let onDayChange = null;

  function toLocalNoon(dateKey) {
    return DateUtils.toLocalNoon(dateKey);
  }

  function formatDateKey(date) {
    return DateUtils.formatDateKey(date);
  }

  function addDays(dateKey, amount) {
    return DateUtils.addDays(dateKey, amount);
  }

  function compareDateKeys(a, b) {
    return DateUtils.compareDateKeys(a, b);
  }

  function getDatesBetween(startKey, endKey, { includeStart = true, includeEnd = true } = {}) {
    return DateUtils.getDatesBetween(startKey, endKey, { includeStart, includeEnd });
  }

  function daysBetween(startKey, endKey) {
    return DateUtils.daysBetween(startKey, endKey);
  }

  function buildDaySummary(data, dateKey) {
    const d = toLocalNoon(dateKey);
    let scheduled = 0;
    let completed = 0;
    let missed = 0;
    let inactive = 0;
    const habits = [];

    (data.habits || []).forEach((h) => {
      if (!Streak.isScheduledDay(h, d)) return;
      scheduled++;

      const status = Streak.getStatus(h, dateKey) || 'pending';
      if (status === 'completed') completed++;
      else if (status === 'missed') missed++;
      else if (status === 'inactive') inactive++;

      habits.push({ id: h.id, title: h.title, status });
    });

    const pending = Math.max(0, scheduled - completed - missed - inactive);
    return {
      date: dateKey,
      scheduled,
      completed,
      missed,
      inactive,
      pending,
      score: scheduled ? Math.round((completed / scheduled) * 100) : 0,
      status: scheduled === 0 ? 'no activity' : completed > 0 ? 'active' : 'inactive',
      habits,
      archivedAt: new Date().toISOString()
    };
  }

  function markSkippedScheduledHabits(data, dateKey) {
    const d = toLocalNoon(dateKey);
    let markedMissed = 0;

    (data.habits || []).forEach((habit) => {
      if (!Streak.isScheduledDay(habit, d)) return;
      if (!habit.history) habit.history = {};

      // Skipped scheduled days become explicit misses so analytics and streaks never have silent gaps.
      if (!habit.history[dateKey]) {
        habit.history[dateKey] = 'missed';
        markedMissed++;
      }
    });

    return markedMissed;
  }

  function archiveMissingDays(data, lastActiveKey, todayKey = Storage.todayKey()) {
    if (!data.dailySummaries) data.dailySummaries = {};
    if (!lastActiveKey || compareDateKeys(lastActiveKey, todayKey) >= 0) {
      return { archivedDates: [], skippedDays: 0, missedAdded: 0 };
    }

    const yesterday = addDays(todayKey, -1);
    const dates = getDatesBetween(lastActiveKey, yesterday);
    let missedAdded = 0;
    const archivedDates = [];

    dates.forEach((dateKey) => {
      missedAdded += markSkippedScheduledHabits(data, dateKey);
      if (!data.dailySummaries[dateKey]) {
        data.dailySummaries[dateKey] = buildDaySummary(data, dateKey);
        archivedDates.push(dateKey);
      }
    });

    data.analytics = data.analytics || {};
    data.analytics.lastArchiveRecovery = {
      from: lastActiveKey,
      to: yesterday,
      skippedDays: dates.length,
      archivedDates,
      missedAdded,
      recoveredAt: new Date().toISOString()
    };

    return {
      archivedDates,
      skippedDays: dates.length,
      missedAdded
    };
  }

  function processDayChange(data) {
    const today = Storage.todayKey();
    const lastActive = data.lastActiveDate || data.activeDate || data.lastVisit || null;

    data.activeDate = today;
    data.lastVisit = today;
    data.lastActiveDate = today;

    if (!lastActive || lastActive === today) {
      data.habits.forEach((h) => Streak.recalculate(h));
      return { changed: false, today, previous: lastActive, skippedDays: 0, archivedDates: [] };
    }

    const archive = archiveMissingDays(data, lastActive, today);
    data.habits.forEach((h) => Streak.recalculate(h));

    return {
      changed: archive.skippedDays > 0,
      today,
      previous: lastActive,
      skippedDays: archive.skippedDays,
      archivedDates: archive.archivedDates,
      missedAdded: archive.missedAdded,
      summary: archive.archivedDates.length
        ? data.dailySummaries[archive.archivedDates[archive.archivedDates.length - 1]]
        : null
    };
  }

  function getTodayStatus(habit) {
    return Streak.getStatus(habit, Storage.todayKey()) || null;
  }

  function scheduleMidnight(callback) {
    if (midnightTimer) clearTimeout(midnightTimer);
    const ms = Storage.msUntilMidnight() + 1500;
    midnightTimer = setTimeout(() => {
      callback();
      scheduleMidnight(callback);
    }, ms);
  }

  function startWatch(callback) {
    onDayChange = callback;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => callback(false), 30000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') callback(false);
    });
    scheduleMidnight(() => callback(true));
  }

  function stopWatch() {
    if (midnightTimer) clearTimeout(midnightTimer);
    if (pollTimer) clearInterval(pollTimer);
    midnightTimer = null;
    pollTimer = null;
  }

  function checkAndApply(data, showToast = false) {
    const result = processDayChange(data);
    if (result.changed) {
      if (showToast && typeof UI !== 'undefined') {
        const msg = result.skippedDays > 1
          ? `${result.skippedDays} days archived - habits refreshed for today!`
          : 'New day - habits refreshed for today!';
        UI.toast(msg, 'info', 4500);
      }
      if (onDayChange) onDayChange(data, result);
    }
    return result;
  }

  return {
    processDayChange,
    buildDaySummary,
    archiveMissingDays,
    getDatesBetween,
    formatDateKey,
    daysBetween,
    getTodayStatus,
    checkAndApply,
    startWatch,
    stopWatch
  };
})();
