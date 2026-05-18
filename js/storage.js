/**
 * storage.js — LocalStorage persistence, defaults, import/export
 */
const Storage = (() => {
  const KEY = 'reflectflow_data';
  const VERSION = 1;
  const DATA_EPOCH = 2; /* bump to reset sample data → fresh start */
  const REQUIRED_IMPORT_FIELDS = ['habits', 'settings', 'notes', 'dailySummaries', 'analytics', 'lastActiveDate'];
  const VALID_THEMES = ['dark', 'light', 'system'];
  const VALID_LAYOUTS = ['default', 'compact', 'wide'];
  const VALID_FREQUENCIES = ['daily', 'weekly', 'custom'];
  const VALID_STATUSES = ['completed', 'missed'];
  const VALID_MOODS = ['great', 'good', 'neutral', 'low', 'bad'];
  let lastImportReport = null;

  const DEFAULT_REMINDERS = [
    { id: 'rem-dsa', label: 'DSA Study', time: '18:00', message: 'Time to learn DSA — consistency beats talent!', enabled: true, habitMatch: 'Learn DSA' },
    { id: 'rem-sleep', label: 'Sleep Reminder', time: '22:45', message: 'Wind down — aim to sleep before 11:30 PM.', enabled: true, habitMatch: 'Sleep before 11:30 PM' },
    { id: 'rem-read', label: 'Reading', time: '21:00', message: '15 minutes of reading compounds into wisdom.', enabled: true, habitMatch: 'Read 15 min or 4 pages' },
    { id: 'rem-gym', label: 'Gym', time: '07:00', message: 'Gym day — show up even when motivation is low.', enabled: true, habitMatch: 'Gym Monday to Saturday' }
  ];

  const QUOTES = [
    { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
    { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' },
    { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
    { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
    { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
    { text: 'The secret of your future is hidden in your daily routine.', author: 'Mike Murdock' },
    { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' }
  ];

  function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /** Local calendar date (YYYY-MM-DD) — resets at midnight in your timezone */
  function dateKey(d = new Date()) {
    return DateUtils.formatDateKey(d);
  }

  function todayKey() {
    return DateUtils.todayKey();
  }

  function msUntilMidnight() {
    return DateUtils.msUntilMidnight();
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function toBoolean(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
  }

  function toNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function sanitizeString(value, fallback = '', maxLength = 240) {
    if (value === undefined || value === null) return fallback;
    // Keep user text readable while removing control characters and markup brackets.
    return String(value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\son[a-z]+\s*=/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, maxLength);
  }

  function sanitizeDateKey(value, fallback = todayKey()) {
    const clean = sanitizeString(value, fallback, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean) && !Number.isNaN(new Date(clean + 'T12:00:00').getTime())) {
      return clean;
    }
    return fallback;
  }

  function sanitizeIsoDate(value, fallback = new Date().toISOString()) {
    const clean = sanitizeString(value, '', 40);
    if (!clean) return fallback;
    const d = new Date(clean);
    return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
  }

  function sanitizeEnum(value, allowed, fallback) {
    const clean = sanitizeString(value, fallback, 40);
    return allowed.includes(clean) ? clean : fallback;
  }

  function sanitizeStringMap(value, maxValueLength = 800) {
    if (!isPlainObject(value)) return {};
    return Object.entries(value).reduce((out, [key, val]) => {
      const safeKey = sanitizeDateKey(key, null);
      if (!safeKey) return out;
      out[safeKey] = sanitizeString(val, '', maxValueLength);
      return out;
    }, {});
  }

  function validateHistory(value) {
    if (!isPlainObject(value)) return {};
    return Object.entries(value).reduce((out, [key, val]) => {
      const safeKey = sanitizeDateKey(key, null);
      const status = sanitizeEnum(val, VALID_STATUSES, '');
      if (safeKey && status) out[safeKey] = status;
      return out;
    }, {});
  }

  function validateCustomDays(value, frequency) {
    const fallback = frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
    if (!Array.isArray(value)) return fallback;
    const days = [...new Set(value.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
    return days.length ? days.sort((a, b) => a - b) : fallback;
  }

  function createDefaultHabit(index = 0, overrides = {}) {
    const now = new Date().toISOString();
    const frequency = sanitizeEnum(overrides.frequency, VALID_FREQUENCIES, 'daily');
    // Build a full habit shape from safe defaults, then layer sanitized imported values on top.
    return {
      id: sanitizeString(overrides.id, uid(), 80) || uid(),
      title: sanitizeString(overrides.title, `Imported Habit ${index + 1}`, 80) || `Imported Habit ${index + 1}`,
      description: sanitizeString(overrides.description, '', 500),
      category: sanitizeString(overrides.category, 'Other', 40) || 'Other',
      target: sanitizeString(overrides.target, '', 120),
      frequency,
      customDays: validateCustomDays(overrides.customDays, frequency),
      createdAt: sanitizeIsoDate(overrides.createdAt, now),
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

  function validateHabit(input, index = 0, report = null) {
    if (!isPlainObject(input)) {
      report?.warnings.push(`Habit at index ${index} was not an object and was replaced.`);
      return createDefaultHabit(index);
    }

    ['id', 'title', 'category', 'frequency', 'createdAt', 'history', 'streak', 'longestStreak'].forEach((field) => {
      if (!(field in input)) report?.warnings.push(`Habit at index ${index} was missing "${field}".`);
    });

    const habit = createDefaultHabit(index, input);
    const longest = Math.max(habit.streak.longest, habit.longestStreak, habit.streak.current);
    habit.streak.longest = longest;
    habit.longestStreak = longest;
    if (typeof Streak !== 'undefined') Streak.recalculate(habit);
    return habit;
  }

  function validateReminder(input, index = 0, report = null) {
    if (!isPlainObject(input)) {
      report?.warnings.push(`Reminder at index ${index} was ignored because it was invalid.`);
      return null;
    }
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

  function validateSettings(input, report = null) {
    const defaults = defaultState().settings;
    if (!isPlainObject(input)) {
      report?.warnings.push('Settings were missing or invalid and defaults were used.');
      return defaults;
    }

    const reminders = Array.isArray(input.reminders)
      ? input.reminders.map((r, index) => validateReminder(r, index, report)).filter(Boolean)
      : DEFAULT_REMINDERS.map((r) => ({ ...r }));

    return {
      theme: sanitizeEnum(input.theme, VALID_THEMES, defaults.theme),
      layout: sanitizeEnum(input.layout, VALID_LAYOUTS, defaults.layout),
      notifications: toBoolean(input.notifications, defaults.notifications),
      reminders,
      onboarded: toBoolean(input.onboarded, true)
    };
  }

  function validateNote(input, index = 0, report = null) {
    if (!isPlainObject(input)) {
      report?.warnings.push(`Note at index ${index} was ignored because it was invalid.`);
      return null;
    }
    return {
      id: sanitizeString(input.id, uid(), 80) || uid(),
      date: sanitizeDateKey(input.date),
      mood: sanitizeEnum(input.mood, VALID_MOODS, 'neutral'),
      content: sanitizeString(input.content, '', 5000),
      createdAt: sanitizeIsoDate(input.createdAt),
      updatedAt: sanitizeIsoDate(input.updatedAt || input.createdAt)
    };
  }

  function validateDailySummaries(input, report = null) {
    if (!isPlainObject(input)) {
      report?.warnings.push('Daily summaries were missing or invalid and were reset.');
      return {};
    }
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
          ? summary.habits
              .filter(isPlainObject)
              .map((h) => ({
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

  function validateAnalytics(input, report = null) {
    if (!isPlainObject(input)) {
      report?.warnings.push('Analytics were missing or invalid and defaults were used.');
      return {};
    }
    return JSON.parse(JSON.stringify(input));
  }

  function sanitizeImportedState(parsed) {
    const report = { warnings: [], repairedFields: [] };
    if (!isPlainObject(parsed)) throw new Error('Import file must contain a JSON object.');

    // Imported files are untrusted. Rebuild a whitelisted state instead of merging blindly.
    REQUIRED_IMPORT_FIELDS.forEach((field) => {
      if (!(field in parsed)) {
        report.repairedFields.push(field);
        report.warnings.push(`Missing top-level field "${field}" was recreated with a safe default.`);
      }
    });

    const fallback = freshStartState();
    const importedHabits = Array.isArray(parsed.habits) ? parsed.habits : [];
    if (!Array.isArray(parsed.habits)) report.warnings.push('Habits were missing or invalid and default habits were used.');

    const habits = importedHabits.length
      ? importedHabits.map((habit, index) => validateHabit(habit, index, report))
      : fallback.habits;

    const seenIds = new Set();
    habits.forEach((habit, index) => {
      if (seenIds.has(habit.id)) {
        report.warnings.push(`Duplicate habit id "${habit.id}" was replaced.`);
        habit.id = uid();
      }
      seenIds.add(habit.id);
      habit.order = index;
    });

    const notes = Array.isArray(parsed.notes)
      ? parsed.notes.map((note, index) => validateNote(note, index, report)).filter(Boolean)
      : [];

    const activeDate = sanitizeDateKey(parsed.activeDate || parsed.lastActiveDate || parsed.lastVisit, todayKey());
    const safeState = {
      version: VERSION,
      dataEpoch: DATA_EPOCH,
      habits,
      notes,
      settings: validateSettings(parsed.settings, report),
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements.map((a) => sanitizeString(a, '', 40)).filter(Boolean) : [],
      quoteIndex: toNumber(parsed.quoteIndex, fallback.quoteIndex, 0, QUOTES.length - 1),
      activeDate,
      lastActiveDate: activeDate,
      lastVisit: sanitizeDateKey(parsed.lastVisit || activeDate, activeDate),
      dailySummaries: validateDailySummaries(parsed.dailySummaries, report),
      analytics: validateAnalytics(parsed.analytics, report)
    };

    if (typeof Daily !== 'undefined') Daily.processDayChange(safeState);
    else safeState.habits.forEach((h) => Streak.recalculate(h));
    safeState.lastActiveDate = safeState.activeDate;
    lastImportReport = report;
    return safeState;
  }

  function createDefaultHabits() {
    const defs = [
      { title: 'Read 15 min or 4 pages', description: 'Daily reading habit', category: 'Learning', target: '15 min or 4 pages', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
      { title: 'Gym Monday to Saturday', description: 'Strength & cardio', category: 'Fitness', target: '45–60 min session', frequency: 'custom', customDays: [1, 2, 3, 4, 5, 6] },
      { title: 'Wake before 8 AM', description: 'Early start', category: 'Lifestyle', target: 'Before 8:00 AM', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
      { title: 'Sleep before 11:30 PM', description: 'Recovery & rest', category: 'Health', target: 'By 11:30 PM', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
      { title: 'Learn DSA', description: 'Data structures & algorithms', category: 'Learning', target: '45 min study', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
      { title: 'Solve LeetCode problem', description: 'One problem minimum', category: 'Career', target: '1 problem', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
      { title: 'Eat properly', description: 'Balanced meals, no junk binge', category: 'Health', target: '3 healthy meals', frequency: 'daily', customDays: [0, 1, 2, 3, 4, 5, 6] },
      { title: 'Be punctual at office', description: 'On time, prepared', category: 'Career', target: 'Arrive on time', frequency: 'custom', customDays: [1, 2, 3, 4, 5] }
    ];

    const now = new Date().toISOString();
    return defs.map((d, i) => ({
      id: uid(),
      title: d.title,
      description: d.description,
      category: d.category,
      target: d.target,
      frequency: d.frequency,
      customDays: d.customDays,
      createdAt: now,
      order: i,
      history: {},
      habitNotes: {},
      streak: { current: 0, longest: 0 },
      consistency: 0
    }));
  }

  /** Clean slate — habits kept, all progress & notes cleared */
  function freshStartState(preserveSettings = null) {
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

  function defaultState() {
    const state = freshStartState();
    state.settings.onboarded = false;
    return state;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      let data = JSON.parse(raw);
      if (!data.version) data.version = VERSION;

      /* One-time migration: clear sample history & notes — start fresh from today */
      if ((data.dataEpoch || 1) < DATA_EPOCH) {
        const preserved = data.settings ? { ...data.settings, onboarded: true } : null;
        data = freshStartState(preserved);
        save(data);
        localStorage.setItem('reflectflow_show_fresh_toast', '1');
        return data;
      }

      if (!data.habits) data.habits = [];
      if (!data.notes) data.notes = [];
      if (!data.dailySummaries) data.dailySummaries = {};
      if (!data.analytics) data.analytics = {};
      if (!data.lastActiveDate) data.lastActiveDate = data.activeDate || data.lastVisit || todayKey();
      if (!data.settings) data.settings = defaultState().settings;
      if (typeof Daily !== 'undefined') {
        Daily.processDayChange(data);
      } else {
        data.activeDate = todayKey();
        data.habits.forEach((h) => Streak.recalculate(h));
      }
      data.lastActiveDate = data.activeDate;
      return data;
    } catch (e) {
      console.warn('Storage load failed, resetting', e);
      return defaultState();
    }
  }

  function save(data) {
    data.lastVisit = todayKey();
    if (!data.activeDate) data.activeDate = todayKey();
    data.lastActiveDate = data.activeDate;
    if (!data.analytics) data.analytics = {};
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('reflectflow:save', { detail: data }));
  }

  function reset() {
    return freshStartState();
  }

  function getJournalForDate(data, dateKey) {
    return (data.notes || []).find((n) => n.date === dateKey) || null;
  }

  /** Daily sheet CSV: habits + habit notes + journal for one date */
  function exportDaySheetCSV(data, dateKey = todayKey()) {
    const d = new Date(dateKey + 'T12:00:00');
    const journal = getJournalForDate(data, dateKey);
    const lines = [];

    lines.push(csvCell(`Daily Sheet — ${dateKey}`));
    lines.push('');
    lines.push(['Habit', 'Category', 'Status', 'Target', 'Habit Note'].map(csvCell).join(','));
    data.habits.forEach((h) => {
      if (!Streak.isScheduledDay(h, d)) return;
      const status = Streak.getStatus(h, dateKey) || 'pending';
      const habitNote = (h.habitNotes || {})[dateKey] || '';
      lines.push(
        [h.title, h.category, status, h.target || '', habitNote].map(csvCell).join(',')
      );
    });
    lines.push('');
    lines.push(['Journal Date', 'Mood', 'Reflection'].map(csvCell).join(','));
    if (journal) {
      lines.push([journal.date, journal.mood, journal.content].map(csvCell).join(','));
    } else {
      lines.push([dateKey, '', 'No journal entry for this day'].map(csvCell).join(','));
    }
    return lines.join('\n');
  }

  function exportDaySheetJSON(data, dateKey = todayKey()) {
    const d = new Date(dateKey + 'T12:00:00');
    const habits = data.habits
      .filter((h) => Streak.isScheduledDay(h, d))
      .map((h) => ({
        title: h.title,
        category: h.category,
        target: h.target,
        status: Streak.getStatus(h, dateKey) || 'pending',
        habitNote: (h.habitNotes || {})[dateKey] || ''
      }));
    return JSON.stringify(
      {
        date: dateKey,
        exportedAt: new Date().toISOString(),
        habits,
        journal: getJournalForDate(data, dateKey)
      },
      null,
      2
    );
  }

  function exportJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  function exportCSV(data) {
    const rows = [
      ['date', 'habit_title', 'category', 'status', 'target', 'habit_note', 'journal_mood', 'journal_reflection']
    ];
    const dates = new Set();
    data.habits.forEach((h) => Object.keys(h.history || {}).forEach((d) => dates.add(d)));
    (data.notes || []).forEach((n) => dates.add(n.date));
    dates.add(todayKey());

    [...dates].sort().forEach((date) => {
      const journal = getJournalForDate(data, date);
      const d = new Date(date + 'T12:00:00');
      const scheduled = data.habits.filter((h) => Streak.isScheduledDay(h, d));
      if (!scheduled.length) {
        if (journal) {
          rows.push([date, '', '', '', '', '', journal.mood, journal.content.replace(/\n/g, ' ')]);
        }
        return;
      }
      scheduled.forEach((h, i) => {
        const status = Streak.getStatus(h, date) || '';
        const habitNote = (h.habitNotes || {})[date] || '';
        rows.push([
          date,
          h.title,
          h.category,
          status,
          h.target || '',
          habitNote,
          i === 0 && journal ? journal.mood : '',
          i === 0 && journal ? journal.content.replace(/\n/g, ' ') : ''
        ]);
      });
    });
    return rows.map((r) => r.map(csvCell).join(',')).join('\n');
  }

  function importJSON(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      const safeState = sanitizeImportedState(parsed);
      if (lastImportReport?.warnings.length) {
        console.warn('ReflectFlow import repaired unsafe or incomplete data:', lastImportReport);
      }
      return safeState;
    } catch (err) {
      lastImportReport = {
        warnings: ['Malformed JSON or unrecoverable import structure.'],
        error: err
      };
      console.warn('ReflectFlow import failed:', err);
      throw new Error('Import failed. Please choose a valid ReflectFlow JSON backup.');
    }
  }

  function getLastImportReport() {
    return lastImportReport;
  }

  function consumeFreshStartToastFlag() {
    const shouldShow = localStorage.getItem('reflectflow_show_fresh_toast') === '1';
    if (shouldShow) localStorage.removeItem('reflectflow_show_fresh_toast');
    return shouldShow;
  }

  function getQuote(index) {
    return QUOTES[index % QUOTES.length];
  }

  return {
    KEY,
    DATA_EPOCH,
    uid,
    todayKey,
    dateKey,
    msUntilMidnight,
    load,
    save,
    reset,
    freshStartState,
    exportJSON,
    exportCSV,
    exportDaySheetCSV,
    exportDaySheetJSON,
    getJournalForDate,
    importJSON,
    getLastImportReport,
    consumeFreshStartToastFlag,
    sanitizeString,
    validateHabit,
    validateSettings,
    createDefaultHabit,
    getQuote,
    QUOTES,
    DEFAULT_REMINDERS
  };
})();
