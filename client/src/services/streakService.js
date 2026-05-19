import { formatDateKey, todayKey } from '../utils/date';
import { calculateStreakFromHistory, getHabitStatusForDate, normalizeHabitHistory, updateHabitHistory } from '../utils/historyHelpers';

export function isScheduledDay(habit, date = new Date()) {
  const dow = date.getDay();
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekly' || habit.frequency === 'custom') {
    return (habit.customDays || []).map(Number).includes(dow);
  }
  return true;
}

export function getStatus(habit, dateKey) {
  return getHabitStatusForDate(habit, dateKey);
}

export function setStatus(habit, dateKey, status) {
  return recalculate(updateHabitHistory(habit, dateKey, status));
}

export function computeCurrentStreak(habit, fromDate = new Date()) {
  return calculateStreakFromHistory(habit, { fromDate, isScheduledDay });
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
  const history = normalizeHabitHistory(habit.history);
  const keys = Object.keys(history).sort();
  let longest = 0;
  let current = 0;
  let prevDate = null;
  keys.forEach((key) => {
    const d = new Date(`${key}T12:00:00`);
    if (!isScheduledDay(habit, d)) return;
    const status = history[key];
    if (status === 'done') {
      current = prevDate && isConsecutiveScheduled(prevDate, d, habit) ? current + 1 : 1;
      longest = Math.max(longest, current);
      prevDate = d;
    } else {
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
    if (getStatus(habit, formatDateKey(d)) === 'done') completed++;
  }
  return scheduled ? Math.round((completed / scheduled) * 100) : 0;
}

export function recalculate(habit) {
  const normalized = { ...habit, history: normalizeHabitHistory(habit.history) };
  const current = computeCurrentStreak(normalized);
  const longest = Math.max(normalized.streak?.longest || 0, computeLongestStreak(normalized), current);
  return {
    ...normalized,
    streak: { current, longest },
    longestStreak: longest,
    consistency: computeConsistency(habit)
  };
}

export function markComplete(habit, dateKey = todayKey()) {
  return setStatus(habit, dateKey, 'done');
}

export function markMissed(habit, dateKey = todayKey()) {
  return setStatus(habit, dateKey, 'missed');
}

export function getLastCompletedDate(habit) {
  return Object.keys(habit.history || {})
    .filter((key) => getStatus(habit, key) === 'done')
    .sort()
    .reverse()[0] || null;
}
