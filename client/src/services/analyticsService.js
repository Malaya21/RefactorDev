import { formatDateKey } from '../utils/date';
import { getStatus, isScheduledDay } from './streakService';

export const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#22c55e', '#3b82f6'];

export function todayStats(state) {
  const today = formatDateKey(new Date());
  const d = new Date(`${today}T12:00:00`);
  let completed = 0;
  let missed = 0;
  let pending = 0;
  let scheduled = 0;
  (state.habits || []).forEach((habit) => {
    if (!isScheduledDay(habit, d)) return;
    scheduled++;
    const status = getStatus(habit, today);
    if (status === 'completed') completed++;
    else if (status === 'missed') missed++;
    else pending++;
  });
  return {
    completed,
    missed,
    pending,
    scheduled,
    total: state.habits?.length || 0,
    score: scheduled ? Math.round((completed / scheduled) * 100) : 0
  };
}

export function globalLongestStreak(state) {
  return (state.habits || []).reduce((max, h) => Math.max(max, h.streak?.longest || 0), 0);
}

export function getDailyCompletion(state, days = 7) {
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    let scheduled = 0;
    let completed = 0;
    (state.habits || []).forEach((habit) => {
      if (!isScheduledDay(habit, d)) return;
      scheduled++;
      if (getStatus(habit, key) === 'completed') completed++;
    });
    result.push({
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      date: key,
      pct: scheduled ? Math.round((completed / scheduled) * 100) : 0,
      completed,
      scheduled
    });
  }
  return result;
}

export function getHabitWeeklyRate(habit, days = 7) {
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

export function getSuccessRates(state) {
  return (state.habits || [])
    .map((habit) => ({
      title: habit.title,
      rate: getHabitWeeklyRate(habit),
      allTime: habit.consistency || 0,
      id: habit.id,
      streak: habit.streak?.current || 0
    }))
    .sort((a, b) => b.rate - a.rate);
}

export function getTopBottom(state) {
  const rates = getSuccessRates(state);
  const withData = rates.filter((r) => r.rate > 0);
  return {
    best: withData[0] || rates[0] || null,
    worst: rates[rates.length - 1] || null
  };
}

export function getHeatmapData(state, weeks = 12) {
  const cells = [];
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - weeks * 7 + 1);
  const d = new Date(start);
  while (d <= now) {
    const key = formatDateKey(d);
    let scheduled = 0;
    let completed = 0;
    (state.habits || []).forEach((habit) => {
      if (!isScheduledDay(habit, d)) return;
      scheduled++;
      if (getStatus(habit, key) === 'completed') completed++;
    });
    cells.push({
      date: key,
      level: scheduled ? Math.min(4, Math.floor((completed / scheduled) * 4)) : 0,
      completed,
      scheduled
    });
    d.setDate(d.getDate() + 1);
  }
  return cells;
}

export function getMonthlyData(state) {
  const now = new Date();
  return [2, 1, 0].map((weekOffset, index) => {
    let total = 0;
    let done = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - weekOffset * 7 - d);
      const key = formatDateKey(date);
      (state.habits || []).forEach((habit) => {
        if (!isScheduledDay(habit, date)) return;
        total++;
        if (getStatus(habit, key) === 'completed') done++;
      });
    }
    return {
      label: `W${index + 1}`,
      sublabel: weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Last week' : '2 wks ago',
      pct: total ? Math.round((done / total) * 100) : 0,
      total,
      done
    };
  });
}
