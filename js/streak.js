/**
 * streak.js — Streak calculation, consistency, scheduled-day logic
 */
const Streak = (() => {
  function isScheduledDay(habit, date = new Date()) {
    const dow = date.getDay();
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekly' || habit.frequency === 'custom') {
      return (habit.customDays || []).map(Number).includes(dow);
    }
    return true;
  }

  function getStatus(habit, dateKey) {
    return (habit.history || {})[dateKey] || null;
  }

  function setStatus(habit, dateKey, status) {
    if (!habit.history) habit.history = {};
    if (status === null) delete habit.history[dateKey];
    else habit.history[dateKey] = status;
    recalculate(habit);
  }

  /** Walk backward from date to compute current streak */
  function computeCurrentStreak(habit, fromDate = new Date()) {
    let streak = 0;
    const d = new Date(fromDate);
    d.setHours(12, 0, 0, 0);

    // If today not completed yet on scheduled day, start from yesterday
    const todayKey = Storage.dateKey(d);
    const todayStatus = getStatus(habit, todayKey);
    if (isScheduledDay(habit, d) && todayStatus !== 'completed') {
      d.setDate(d.getDate() - 1);
    }

    for (let i = 0; i < 400; i++) {
      if (!isScheduledDay(habit, d)) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      const key = Storage.dateKey(d);
      const st = getStatus(habit, key);
      if (st === 'completed') {
        streak++;
        d.setDate(d.getDate() - 1);
      } else if (st === 'missed') {
        break;
      } else {
        // No entry: break streak unless it's today (pending)
        if (key === Storage.todayKey()) break;
        break;
      }
    }
    return streak;
  }

  function computeLongestStreak(habit) {
    const keys = Object.keys(habit.history || {}).sort();
    if (!keys.length) return 0;

    let longest = 0;
    let current = 0;
    let prevDate = null;

    keys.forEach((key) => {
      const d = new Date(key + 'T12:00:00');
      if (!isScheduledDay(habit, d)) return;
      const st = habit.history[key];
      if (st === 'completed') {
        if (prevDate && isConsecutiveScheduled(prevDate, d, habit)) {
          current++;
        } else {
          current = 1;
        }
        longest = Math.max(longest, current);
        prevDate = d;
      } else if (st === 'missed') {
        current = 0;
        prevDate = d;
      }
    });
    return longest;
  }

  function isConsecutiveScheduled(prev, curr, habit) {
    const d = new Date(prev);
    d.setDate(d.getDate() + 1);
    while (d <= curr) {
      if (isScheduledDay(habit, d)) {
        return Storage.dateKey(d) === Storage.dateKey(curr);
      }
      d.setDate(d.getDate() + 1);
    }
    return false;
  }

  function computeConsistency(habit, days = 30) {
    let scheduled = 0;
    let completed = 0;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (!isScheduledDay(habit, d)) continue;
      scheduled++;
      if (getStatus(habit, Storage.dateKey(d)) === 'completed') completed++;
    }
    return scheduled ? Math.round((completed / scheduled) * 100) : 0;
  }

  function recalculate(habit) {
    habit.streak = habit.streak || { current: 0, longest: 0 };
    habit.streak.current = computeCurrentStreak(habit);
    const longest = computeLongestStreak(habit);
    habit.streak.longest = Math.max(habit.streak.longest, longest, habit.streak.current);
    habit.consistency = computeConsistency(habit);
    return habit;
  }

  function getLastCompletedDate(habit) {
    const keys = Object.keys(habit.history || {})
      .filter((k) => habit.history[k] === 'completed')
      .sort()
      .reverse();
    return keys[0] || null;
  }

  function markComplete(habit, dateKey = Storage.todayKey()) {
    setStatus(habit, dateKey, 'completed');
    return habit;
  }

  function markMissed(habit, dateKey = Storage.todayKey()) {
    setStatus(habit, dateKey, 'missed');
    habit.streak.current = 0;
    recalculate(habit);
    return habit;
  }

  return {
    isScheduledDay,
    getStatus,
    setStatus,
    recalculate,
    computeCurrentStreak,
    computeLongestStreak,
    computeConsistency,
    getLastCompletedDate,
    markComplete,
    markMissed
  };
})();
