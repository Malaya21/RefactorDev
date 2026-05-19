import { formatDateKey } from './date';

export const HABIT_STATUSES = ['done', 'missed', 'pending'];

export function normalizeHabitStatus(status) {
  if (status === 'completed' || status === 'done') return 'done';
  if (status === 'missed') return 'missed';
  if (status === 'pending') return 'pending';
  return null;
}

export function normalizeHabitHistory(history) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) return {};
  return Object.entries(history).reduce((out, [dateKey, status]) => {
    const normalized = normalizeHabitStatus(status);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && normalized) {
      out[dateKey] = normalized;
    }
    return out;
  }, {});
}

export function getHabitStatusForDate(habit, dateKey) {
  return normalizeHabitStatus((habit?.history || {})[dateKey]) || 'pending';
}

export function updateHabitHistory(habit, dateKey, status) {
  const normalized = normalizeHabitStatus(status) || 'pending';
  const history = normalizeHabitHistory(habit?.history);
  history[dateKey] = normalized;
  return { ...habit, history };
}

export function hasDoneStatus(habit, dateKey) {
  return getHabitStatusForDate(habit, dateKey) === 'done';
}

export function calculateStreakFromHistory(habit, {
  fromDate = new Date(),
  isScheduledDay = () => true,
  maxDays = 400
} = {}) {
  const normalizedHabit = { ...habit, history: normalizeHabitHistory(habit?.history) };
  let streak = 0;
  const d = new Date(fromDate);
  d.setHours(12, 0, 0, 0);
  const key = formatDateKey(d);

  if (isScheduledDay(normalizedHabit, d) && getHabitStatusForDate(normalizedHabit, key) !== 'done') {
    d.setDate(d.getDate() - 1);
  }

  for (let i = 0; i < maxDays; i++) {
    if (!isScheduledDay(normalizedHabit, d)) {
      d.setDate(d.getDate() - 1);
      continue;
    }

    const dateKey = formatDateKey(d);
    if (getHabitStatusForDate(normalizedHabit, dateKey) === 'done') {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
