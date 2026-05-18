import { addDays, compareDateKeys, getDatesBetween, todayKey, toLocalNoon } from '../utils/date';
import { getStatus, isScheduledDay, recalculate } from './streakService';

export function buildDaySummary(data, dateKey) {
  const d = toLocalNoon(dateKey);
  let scheduled = 0;
  let completed = 0;
  let missed = 0;
  const habits = [];

  (data.habits || []).forEach((habit) => {
    if (!isScheduledDay(habit, d)) return;
    scheduled++;
    const status = getStatus(habit, dateKey) || 'pending';
    if (status === 'completed') completed++;
    else if (status === 'missed') missed++;
    habits.push({ id: habit.id, title: habit.title, status });
  });

  return {
    date: dateKey,
    scheduled,
    completed,
    missed,
    inactive: scheduled && !completed ? scheduled - missed : 0,
    pending: Math.max(0, scheduled - completed - missed),
    score: scheduled ? Math.round((completed / scheduled) * 100) : 0,
    status: scheduled === 0 ? 'no activity' : completed > 0 ? 'active' : 'inactive',
    habits,
    archivedAt: new Date().toISOString()
  };
}

export function archiveMissingDays(state, lastActiveKey, currentKey = todayKey()) {
  if (!lastActiveKey || compareDateKeys(lastActiveKey, currentKey) >= 0) {
    return { state, result: { changed: false, skippedDays: 0, archivedDates: [] } };
  }

  const yesterday = addDays(currentKey, -1);
  const dates = getDatesBetween(lastActiveKey, yesterday);
  const summaries = { ...(state.dailySummaries || {}) };
  let missedAdded = 0;
  const archivedDates = [];

  let habits = (state.habits || []).map((habit) => {
    const history = { ...(habit.history || {}) };
    dates.forEach((dateKey) => {
      if (isScheduledDay(habit, toLocalNoon(dateKey)) && !history[dateKey]) {
        history[dateKey] = 'missed';
        missedAdded++;
      }
    });
    return { ...habit, history };
  });

  const summaryState = { ...state, habits };
  dates.forEach((dateKey) => {
    if (!summaries[dateKey]) {
      summaries[dateKey] = buildDaySummary(summaryState, dateKey);
      archivedDates.push(dateKey);
    }
  });

  habits = habits.map(recalculate);
  const nextState = {
    ...state,
    habits,
    activeDate: currentKey,
    lastActiveDate: currentKey,
    lastVisit: currentKey,
    dailySummaries: summaries,
    analytics: {
      ...(state.analytics || {}),
      lastArchiveRecovery: {
        from: lastActiveKey,
        to: yesterday,
        skippedDays: dates.length,
        archivedDates: dates,
        missedAdded,
        recoveredAt: new Date().toISOString()
      }
    }
  };

  return {
    state: nextState,
    result: {
      changed: dates.length > 0,
      today: currentKey,
      previous: lastActiveKey,
      skippedDays: dates.length,
      archivedDates,
      missedAdded
    }
  };
}

export function processDayChange(state) {
  const currentKey = todayKey();
  const lastActive = state.lastActiveDate || state.activeDate || state.lastVisit || null;
  if (!lastActive || lastActive === currentKey) {
    return {
      state: {
        ...state,
        activeDate: currentKey,
        lastActiveDate: currentKey,
        lastVisit: currentKey,
        habits: (state.habits || []).map(recalculate)
      },
      result: { changed: false, today: currentKey, previous: lastActive, skippedDays: 0, archivedDates: [] }
    };
  }
  return archiveMissingDays(state, lastActive, currentKey);
}
