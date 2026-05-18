import { formatDateKey, todayKey } from '../utils/date';

export function isScheduledDay(habit, date = new Date()) {
  const dow = date.getDay();
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekly' || habit.frequency === 'custom') {
    return (habit.customDays || []).map(Number).includes(dow);
  }
  return true;
}

export function getStatus(habit, dateKey) {
  return (habit.history || {})[dateKey] || null;
}

export function setStatus(habit, dateKey, status) {
  const next = { ...habit, history: { ...(habit.history || {}) } };
  if (status === null) delete next.history[dateKey];
  else next.history[dateKey] = status;
  return recalculate(next);
}

export function computeCurrentStreak(habit, fromDate = new Date()) {
  let streak = 0;
  const d = new Date(fromDate);
  d.setHours(12, 0, 0, 0);
  const key = formatDateKey(d);
  if (isScheduledDay(habit, d) && getStatus(habit, key) !== 'completed') {
    d.setDate(d.getDate() - 1);
  }

  for (let i = 0; i < 400; i++) {
    if (!isScheduledDay(habit, d)) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    const date = formatDateKey(d);
    const status = getStatus(habit, date);
    if (status === 'completed') {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function isConsecutiveScheduled(prev, curr, habit) {
  const d = new Date(prev);
  d.setDate(d.getDate() + 1);
  while (d <= curr) {
    if (isScheduledDay(habit, d)) return formatDateKey(d) === formatDateKey(curr);
    d.setDate(d.getDate() + 1);
  }
  return false;
}

export function computeLongestStreak(habit) {
  const keys = Object.keys(habit.history || {}).sort();
  let longest = 0;
  let current = 0;
  let prevDate = null;
  keys.forEach((key) => {
    const d = new Date(`${key}T12:00:00`);
    if (!isScheduledDay(habit, d)) return;
    const status = habit.history[key];
    if (status === 'completed') {
      current = prevDate && isConsecutiveScheduled(prevDate, d, habit) ? current + 1 : 1;
      longest = Math.max(longest, current);
      prevDate = d;
    } else if (status === 'missed') {
      current = 0;
      prevDate = d;
    }
  });
  return longest;
}

export function computeConsistency(habit, days = 30) {
  let scheduled = 0;
  let completed = 0;
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (!isScheduledDay(habit, d)) continue;
    scheduled++;
    if (getStatus(habit, formatDateKey(d)) === 'completed') completed++;
  }
  return scheduled ? Math.round((completed / scheduled) * 100) : 0;
}

export function recalculate(habit) {
  const current = computeCurrentStreak(habit);
  const longest = Math.max(habit.streak?.longest || 0, computeLongestStreak(habit), current);
  return {
    ...habit,
    streak: { current, longest },
    longestStreak: longest,
    consistency: computeConsistency(habit)
  };
}

export function markComplete(habit, dateKey = todayKey()) {
  return setStatus(habit, dateKey, 'completed');
}

export function markMissed(habit, dateKey = todayKey()) {
  return setStatus(habit, dateKey, 'missed');
}

export function getLastCompletedDate(habit) {
  return Object.keys(habit.history || {})
    .filter((key) => habit.history[key] === 'completed')
    .sort()
    .reverse()[0] || null;
}
