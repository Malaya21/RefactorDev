import { todayKey, msUntilMidnight } from '../utils/date';
import { sanitizeString } from '../utils/security';
import {
  isPlainObject,
  sanitizeDateKey,
  sanitizeEnum,
  sanitizeIsoDate,
  sanitizeStringMap,
  toBoolean,
  toNumber,
  validateCustomDays,
  validateHistory,
  VALID_FREQUENCIES,
  VALID_LAYOUTS,
  VALID_MOODS,
  VALID_STATUSES,
  VALID_THEMES
} from '../utils/validation';
import { recalculate, isScheduledDay, getStatus } from '../services/streakService';
import { processDayChange } from '../services/archiveService';

export const KEY = 'reflectflow_data';
export const VERSION = 1;
export const DATA_EPOCH = 2;

export const DEFAULT_REMINDERS = [
  { id: 'rem-dsa', label: 'DSA Study', time: '18:00', message: 'Time to learn DSA - consistency beats talent!', enabled: true, habitMatch: 'Learn DSA' },
  { id: 'rem-sleep', label: 'Sleep Reminder', time: '22:45', message: 'Wind down - aim to sleep before 11:30 PM.', enabled: true, habitMatch: 'Sleep before 11:30 PM' },
  { id: 'rem-read', label: 'Reading', time: '21:00', message: '15 minutes of reading compounds into wisdom.', enabled: true, habitMatch: 'Read 15 min or 4 pages' },
  { id: 'rem-gym', label: 'Gym', time: '07:00', message: 'Gym day - show up even when motivation is low.', enabled: true, habitMatch: 'Gym Monday to Saturday' }
];

export const QUOTES = [
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
  { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
  { text: 'The secret of your future is hidden in your daily routine.', author: 'Mike Murdock' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' }
];

let lastImportReport = null;

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultHabit(index = 0, overrides = {}) {
  const frequency = sanitizeEnum(overrides.frequency, VALID_FREQUENCIES, 'daily');
  return {
    id: sanitizeString(overrides.id, uid(), 80) || uid(),
    title: sanitizeString(overrides.title, `Imported Habit ${index + 1}`, 80) || `Imported Habit ${index + 1}`,
    description: sanitizeString(overrides.description, '', 500),
    category: sanitizeString(overrides.category, 'Other', 40) || 'Other',
    target: sanitizeString(overrides.target, '', 120),
    frequency,
    customDays: validateCustomDays(overrides.customDays, frequency),
    createdAt: sanitizeIsoDate(overrides.createdAt),
    order: toNumber(overrides.order, index, 0),
    history: validateHistory(overrides.history),
    habitNotes: sanitizeStringMap(overrides.habitNotes, 800),
    streak: {
      current: toNumber(overrides.streak?.current, 0, 0),
      longest: toNumber(overrides.streak?.longest ?? overrides.longestStreak, 0, 0)
    },
    longestStreak: toNumber(overrides.longestStreak ?? overrides.streak?.longest, 0, 0),
    consistency: toNumber(overrides.consistency, 0, 0, 100)
  };
}

export function createDefaultHabits() {
  const defs = [
    { title: 'Read 15 min or 4 pages', description: 'Daily reading habit', category: 'Learning', target: '15 min or 4 pages', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
    { title: 'Gym Monday to Saturday', description: 'Strength & cardio', category: 'Fitness', target: '45-60 min session', frequency: 'custom', customDays: [1, 2, 3, 4, 5, 6] },
    { title: 'Wake before 8 AM', description: 'Early start', category: 'Lifestyle', target: 'Before 8:00 AM', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
    { title: 'Sleep before 11:30 PM', description: 'Recovery & rest', category: 'Health', target: 'By 11:30 PM', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
    { title: 'Learn DSA', description: 'Data structures & algorithms', category: 'Learning', target: '45 min study', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
    { title: 'Solve LeetCode problem', description: 'One problem minimum', category: 'Career', target: '1 problem', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
    { title: 'Eat properly', description: 'Balanced meals, no junk binge', category: 'Health', target: '3 healthy meals', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
    { title: 'Be punctual at office', description: 'On time, prepared', category: 'Career', target: 'Arrive on time', frequency: 'custom', customDays: [1, 2, 3, 4, 5] }
  ];
  return defs.map((habit, index) => recalculate(createDefaultHabit(index, habit)));
}

export function freshStartState(preserveSettings = null) {
  return {
    version: VERSION,
    dataEpoch: DATA_EPOCH,
    habits: createDefaultHabits(),
    notes: [],
    settings: preserveSettings || {
      theme: 'dark',
      layout: 'default',
      notifications: false,
      reminders: DEFAULT_REMINDERS.map((r) => ({ ...r })),
      onboarded: true
    },
    achievements: [],
    quoteIndex: Math.floor(Math.random() * QUOTES.length),
    activeDate: todayKey(),
    lastActiveDate: todayKey(),
    lastVisit: todayKey(),
    dailySummaries: {},
    analytics: {}
  };
}

export function defaultState() {
  const state = freshStartState();
  state.settings.onboarded = false;
  return state;
}

export function validateHabit(input, index = 0, report = null) {
  if (!isPlainObject(input)) {
    report?.warnings.push(`Habit at index ${index} was replaced.`);
    return createDefaultHabit(index);
  }
  ['id', 'title', 'category', 'frequency', 'createdAt', 'history', 'streak', 'longestStreak'].forEach((field) => {
    if (!(field in input)) report?.warnings.push(`Habit at index ${index} was missing "${field}".`);
  });
  return recalculate(createDefaultHabit(index, input));
}

function validateReminder(input, index = 0) {
  if (!isPlainObject(input)) return null;
  const time = sanitizeString(input.time, '09:00', 5);
  return {
    id: sanitizeString(input.id, `rem-${index}`, 80) || `rem-${index}`,
    label: sanitizeString(input.label, 'Reminder', 80) || 'Reminder',
    time: /^\d{2}:\d{2}$/.test(time) ? time : '09:00',
    message: sanitizeString(input.message, 'Time to check your habits.', 200),
    enabled: toBoolean(input.enabled, false),
    habitMatch: sanitizeString(input.habitMatch, '', 120)
  };
}

export function validateSettings(input) {
  const defaults = defaultState().settings;
  if (!isPlainObject(input)) return defaults;
  return {
    theme: sanitizeEnum(input.theme, VALID_THEMES, defaults.theme),
    layout: sanitizeEnum(input.layout, VALID_LAYOUTS, defaults.layout),
    notifications: toBoolean(input.notifications, defaults.notifications),
    reminders: Array.isArray(input.reminders)
      ? input.reminders.map(validateReminder).filter(Boolean)
      : DEFAULT_REMINDERS.map((r) => ({ ...r })),
    onboarded: toBoolean(input.onboarded, true)
  };
}

function validateNote(input) {
  if (!isPlainObject(input)) return null;
  return {
    id: sanitizeString(input.id, uid(), 80) || uid(),
    date: sanitizeDateKey(input.date),
    mood: sanitizeEnum(input.mood, VALID_MOODS, 'neutral'),
    content: sanitizeString(input.content, '', 5000),
    createdAt: sanitizeIsoDate(input.createdAt),
    updatedAt: sanitizeIsoDate(input.updatedAt || input.createdAt)
  };
}

function validateDailySummaries(input) {
  if (!isPlainObject(input)) return {};
  return Object.entries(input).reduce((out, [key, summary]) => {
    const safeKey = sanitizeDateKey(key, null);
    if (!safeKey || !isPlainObject(summary)) return out;
    out[safeKey] = {
      date: sanitizeDateKey(summary.date, safeKey),
      scheduled: toNumber(summary.scheduled, 0, 0),
      completed: toNumber(summary.completed, 0, 0),
      missed: toNumber(summary.missed, 0, 0),
      pending: toNumber(summary.pending, 0, 0),
      score: toNumber(summary.score, 0, 0, 100),
      habits: Array.isArray(summary.habits)
        ? summary.habits.filter(isPlainObject).map((h) => ({
            id: sanitizeString(h.id, '', 80),
            title: sanitizeString(h.title, 'Untitled habit', 80),
            status: sanitizeEnum(h.status, [...VALID_STATUSES, 'pending'], 'pending')
          }))
        : [],
      archivedAt: sanitizeIsoDate(summary.archivedAt)
    };
    return out;
  }, {});
}

export function sanitizeImportedState(parsed) {
  const report = { warnings: [], repairedFields: [] };
  if (!isPlainObject(parsed)) throw new Error('Import file must contain a JSON object.');
  ['habits', 'settings', 'notes', 'dailySummaries', 'analytics', 'lastActiveDate'].forEach((field) => {
    if (!(field in parsed)) {
      report.repairedFields.push(field);
      report.warnings.push(`Missing top-level field "${field}" was recreated.`);
    }
  });

  const fallback = freshStartState();
  const habits = Array.isArray(parsed.habits) && parsed.habits.length
    ? parsed.habits.map((habit, index) => validateHabit(habit, index, report))
    : fallback.habits;
  const seen = new Set();
  habits.forEach((habit, index) => {
    if (seen.has(habit.id)) habit.id = uid();
    seen.add(habit.id);
    habit.order = index;
  });

  const activeDate = sanitizeDateKey(parsed.activeDate || parsed.lastActiveDate || parsed.lastVisit, todayKey());
  const safe = {
    version: VERSION,
    dataEpoch: DATA_EPOCH,
    habits,
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(validateNote).filter(Boolean) : [],
    settings: validateSettings(parsed.settings),
    achievements: Array.isArray(parsed.achievements) ? parsed.achievements.map((a) => sanitizeString(a, '', 40)).filter(Boolean) : [],
    quoteIndex: toNumber(parsed.quoteIndex, fallback.quoteIndex, 0, QUOTES.length - 1),
    activeDate,
    lastActiveDate: activeDate,
    lastVisit: sanitizeDateKey(parsed.lastVisit || activeDate, activeDate),
    dailySummaries: validateDailySummaries(parsed.dailySummaries),
    analytics: isPlainObject(parsed.analytics) ? JSON.parse(JSON.stringify(parsed.analytics)) : {}
  };
  lastImportReport = report;
  return processDayChange(safe).state;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    let data = JSON.parse(raw);
    if ((data.dataEpoch || 1) < DATA_EPOCH) {
      const preserved = data.settings ? { ...data.settings, onboarded: true } : null;
      data = freshStartState(preserved);
      localStorage.setItem('reflectflow_show_fresh_toast', '1');
      saveState(data);
      return data;
    }
    data = sanitizeImportedState({
      ...data,
      settings: data.settings || defaultState().settings,
      notes: data.notes || [],
      habits: data.habits || [],
      dailySummaries: data.dailySummaries || {},
      analytics: data.analytics || {},
      lastActiveDate: data.lastActiveDate || data.activeDate || data.lastVisit || todayKey()
    });
    return data;
  } catch (error) {
    console.warn('Storage load failed, resetting:', error);
    return defaultState();
  }
}

export function saveState(state) {
  const safeState = {
    ...state,
    lastVisit: todayKey(),
    activeDate: state.activeDate || todayKey(),
    lastActiveDate: state.lastActiveDate || state.activeDate || todayKey(),
    analytics: state.analytics || {}
  };
  localStorage.setItem(KEY, JSON.stringify(safeState));
  return safeState;
}

export function importJSON(jsonStr) {
  try {
    return sanitizeImportedState(JSON.parse(jsonStr));
  } catch (error) {
    lastImportReport = { warnings: ['Malformed JSON or unrecoverable import structure.'], error };
    console.warn('ReflectFlow import failed:', error);
    throw new Error('Import failed. Please choose a valid ReflectFlow JSON backup.');
  }
}

export function getLastImportReport() {
  return lastImportReport;
}

export function consumeFreshStartToastFlag() {
  const shouldShow = localStorage.getItem('reflectflow_show_fresh_toast') === '1';
  if (shouldShow) localStorage.removeItem('reflectflow_show_fresh_toast');
  return shouldShow;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function getJournalForDate(state, dateKey) {
  return (state.notes || []).find((n) => n.date === dateKey) || null;
}

export function exportDaySheetCSV(state, dateKey = todayKey()) {
  const d = new Date(`${dateKey}T12:00:00`);
  const lines = [csvCell(`Daily Sheet - ${dateKey}`), '', ['Habit', 'Category', 'Status', 'Target', 'Habit Note'].map(csvCell).join(',')];
  state.habits.forEach((habit) => {
    if (!isScheduledDay(habit, d)) return;
    lines.push([habit.title, habit.category, getStatus(habit, dateKey) || 'pending', habit.target || '', (habit.habitNotes || {})[dateKey] || ''].map(csvCell).join(','));
  });
  const journal = getJournalForDate(state, dateKey);
  lines.push('', ['Journal Date', 'Mood', 'Reflection'].map(csvCell).join(','));
  lines.push(journal ? [journal.date, journal.mood, journal.content].map(csvCell).join(',') : [dateKey, '', 'No journal entry for this day'].map(csvCell).join(','));
  return lines.join('\n');
}

export function exportDaySheetJSON(state, dateKey = todayKey()) {
  const d = new Date(`${dateKey}T12:00:00`);
  return JSON.stringify({
    date: dateKey,
    exportedAt: new Date().toISOString(),
    habits: state.habits.filter((h) => isScheduledDay(h, d)).map((h) => ({
      title: h.title,
      category: h.category,
      target: h.target,
      status: getStatus(h, dateKey) || 'pending',
      habitNote: (h.habitNotes || {})[dateKey] || ''
    })),
    journal: getJournalForDate(state, dateKey)
  }, null, 2);
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

export function exportCSV(state) {
  const rows = [['date', 'habit_title', 'category', 'status', 'target', 'habit_note', 'journal_mood', 'journal_reflection']];
  const dates = new Set([todayKey()]);
  state.habits.forEach((h) => Object.keys(h.history || {}).forEach((d) => dates.add(d)));
  state.notes.forEach((n) => dates.add(n.date));
  [...dates].sort().forEach((date) => {
    const journal = getJournalForDate(state, date);
    const d = new Date(`${date}T12:00:00`);
    state.habits.filter((h) => isScheduledDay(h, d)).forEach((habit, index) => {
      rows.push([
        date,
        habit.title,
        habit.category,
        getStatus(habit, date) || '',
        habit.target || '',
        (habit.habitNotes || {})[date] || '',
        index === 0 && journal ? journal.mood : '',
        index === 0 && journal ? journal.content.replace(/\n/g, ' ') : ''
      ]);
    });
  });
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function resetState() {
  return freshStartState();
}

export { todayKey, msUntilMidnight };
