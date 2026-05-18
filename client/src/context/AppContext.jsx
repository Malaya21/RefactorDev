import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  consumeFreshStartToastFlag,
  importJSON,
  loadState,
  QUOTES,
  resetState,
  saveState,
  uid
} from '../storage/storageService';
import { sanitizeString } from '../utils/security';
import { todayKey, msUntilMidnight } from '../utils/date';
import { markComplete, markMissed, recalculate, setStatus } from '../services/streakService';
import { processDayChange } from '../services/archiveService';
import { getNotificationStatus, requestNotificationPermission } from '../services/notificationService';
import { logoutUser, observeAuthState } from '../services/authService';
import { useNotifications } from '../hooks/useNotifications';

const AppContext = createContext(null);

function createToast(message, type = 'info', duration = 3200) {
  return { id: uid(), message, type, duration };
}

export function AppProvider({ children }) {
  const [state, setState] = useState(() => loadState());
  const [auth, setAuth] = useState({
    user: null,
    loading: true
  });
  const [ui, setUi] = useState({
    sidebarOpen: false,
    activeModal: null,
    editingHabit: null,
    editingNote: null,
    habitNoteId: null,
    notificationOpen: false,
    notificationStatus: getNotificationStatus(state.settings),
    search: '',
    toasts: []
  });

  const commit = useCallback((updater, options = {}) => {
    setState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next === current) return current;
      return options.persist === false ? next : saveState(next);
    });
  }, []);

  const toast = useCallback((message, type = 'info', duration = 3200) => {
    const item = createToast(message, type, duration);
    setUi((current) => ({ ...current, toasts: [...current.toasts, item] }));
    window.setTimeout(() => {
      setUi((current) => ({ ...current, toasts: current.toasts.filter((t) => t.id !== item.id) }));
    }, duration + 350);
  }, []);

  const closeToast = useCallback((id) => {
    setUi((current) => ({ ...current, toasts: current.toasts.filter((t) => t.id !== id) }));
  }, []);

  const actions = useMemo(() => ({
    commit,
    toast,
    closeToast,
    async logout() {
      try {
        await logoutUser();
        toast('Signed out of ReflectFlow', 'info');
      } catch (error) {
        console.warn('Sign out failed:', error);
        toast('Could not sign out. Please try again.', 'error');
      }
    },
    setSearch(search) {
      setUi((current) => ({ ...current, search }));
    },
    toggleSidebar(open = null) {
      setUi((current) => ({ ...current, sidebarOpen: open ?? !current.sidebarOpen }));
    },
    toggleNotifications(open = null) {
      setUi((current) => ({ ...current, notificationOpen: open ?? !current.notificationOpen }));
    },
    closeTransientUi() {
      setUi((current) => ({
        ...current,
        sidebarOpen: false,
        notificationOpen: false,
        activeModal: null,
        editingHabit: null,
        editingNote: null,
        habitNoteId: null
      }));
    },
    openHabitModal(habit = null) {
      setUi((current) => ({ ...current, notificationOpen: false, activeModal: 'habit', editingHabit: habit }));
    },
    openNoteModal(note = null) {
      setUi((current) => ({ ...current, notificationOpen: false, activeModal: 'note', editingNote: note }));
    },
    openHabitNote(habitId) {
      setUi((current) => ({ ...current, notificationOpen: false, activeModal: 'habit-note', habitNoteId: habitId }));
    },
    closeModal() {
      setUi((current) => ({ ...current, activeModal: null, editingHabit: null, editingNote: null, habitNoteId: null }));
    },
    saveHabit(payload) {
      commit((current) => {
        const id = payload.id;
        const frequency = ['daily', 'weekly', 'custom'].includes(payload.frequency) ? payload.frequency : 'daily';
        if (id) {
          return {
            ...current,
            habits: current.habits.map((habit) =>
              habit.id === id
                ? recalculate({
                    ...habit,
                    title: sanitizeString(payload.title, habit.title, 80),
                    description: sanitizeString(payload.description, '', 500),
                    category: sanitizeString(payload.category, 'Other', 40) || 'Other',
                    target: sanitizeString(payload.target, '', 120),
                    frequency,
                    customDays: payload.customDays
                  })
                : habit
            )
          };
        }
        const habit = recalculate({
          id: uid(),
          title: sanitizeString(payload.title, 'Untitled Habit', 80),
          description: sanitizeString(payload.description, '', 500),
          category: sanitizeString(payload.category, 'Other', 40) || 'Other',
          target: sanitizeString(payload.target, '', 120),
          frequency,
          customDays: payload.customDays,
          createdAt: new Date().toISOString(),
          order: current.habits.length,
          history: {},
          habitNotes: {},
          streak: { current: 0, longest: 0 },
          consistency: 0
        });
        return { ...current, habits: [...current.habits, habit] };
      });
      toast(payload.id ? 'Habit updated' : 'Habit added', 'success');
    },
    deleteHabit(id) {
      commit((current) => ({ ...current, habits: current.habits.filter((habit) => habit.id !== id) }));
      toast('Habit deleted', 'info');
    },
    markHabit(id, status) {
      commit((current) => ({
        ...current,
        habits: current.habits.map((habit) => {
          if (habit.id !== id) return habit;
          return status === 'completed' ? markComplete(habit) : markMissed(habit);
        })
      }));
      toast(status === 'completed' ? 'Habit completed!' : 'Habit marked missed', status === 'completed' ? 'success' : 'warning');
    },
    clearHabitStatus(id) {
      commit((current) => ({
        ...current,
        habits: current.habits.map((habit) => (habit.id === id ? setStatus(habit, todayKey(), null) : habit))
      }));
    },
    saveHabitNote(id, text) {
      commit((current) => ({
        ...current,
        habits: current.habits.map((habit) => {
          if (habit.id !== id) return habit;
          const habitNotes = { ...(habit.habitNotes || {}) };
          const clean = sanitizeString(text, '', 800);
          if (clean) habitNotes[todayKey()] = clean;
          else delete habitNotes[todayKey()];
          return { ...habit, habitNotes };
        })
      }));
      toast('Note saved', 'success');
    },
    saveNote(payload) {
      commit((current) => {
        if (payload.id) {
          return {
            ...current,
            notes: current.notes.map((note) =>
              note.id === payload.id
                ? { ...note, date: payload.date, mood: payload.mood, content: sanitizeString(payload.content, '', 5000), updatedAt: new Date().toISOString() }
                : note
            )
          };
        }
        return {
          ...current,
          notes: [
            ...current.notes,
            { id: uid(), date: payload.date, mood: payload.mood, content: sanitizeString(payload.content, '', 5000), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          ]
        };
      });
      toast(payload.id ? 'Entry updated' : 'Entry saved', 'success');
    },
    deleteNote(id) {
      commit((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }));
      toast('Entry deleted', 'info');
    },
    updateSettings(patch) {
      commit((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
    },
    async setNotificationsEnabled(enabled) {
      if (!enabled) {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: false } }));
        toast('Browser reminders disabled', 'info');
        return;
      }

      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: true } }));
        toast('Notifications enabled! Habit reminders are active.', 'success');
      } else if (permission === 'denied') {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: false } }));
        toast('Notifications are blocked. Enable them in browser site settings.', 'warning', 6000);
      } else if (permission === 'unsupported') {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: false } }));
        toast('This browser does not support notifications.', 'warning', 6000);
      } else {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: false } }));
        toast('Notification permission was not granted.', 'warning');
      }
    },
    updateReminder(id, patch) {
      commit((current) => ({
        ...current,
        settings: {
          ...current.settings,
          reminders: current.settings.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r))
        }
      }));
    },
    async enableNotifications() {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: true } }));
        toast('Notifications enabled! Habit reminders are active.', 'success');
      } else if (permission === 'denied') {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: false } }));
        toast('Notifications are blocked. Enable them in browser site settings.', 'warning', 6000);
      } else if (permission === 'unsupported') {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: false } }));
        toast('This browser does not support notifications.', 'warning', 6000);
      } else {
        commit((current) => ({ ...current, settings: { ...current.settings, notifications: false } }));
        toast('Notification permission was not granted.', 'warning');
      }
    },
    importBackup(text) {
      const imported = importJSON(text);
      commit(imported);
      toast('Data imported successfully', 'success');
    },
    resetAll() {
      commit(resetState());
      toast('Fresh start! All progress cleared - begin from today.', 'success');
    }
  }), [closeToast, commit, toast]);

  useEffect(() => {
    const unsubscribe = observeAuthState((user) => {
      setAuth({ user, loading: false });
    });

    return unsubscribe;
  }, []);

  useNotifications(state, {
    onStatusChange: useCallback((status) => {
      setUi((current) => current.notificationStatus?.state === status.state && current.notificationStatus?.detail === status.detail
        ? current
        : { ...current, notificationStatus: status });
    }, []),
    onPermissionDenied: useCallback(() => {
      commit((current) => current.settings.notifications
        ? { ...current, settings: { ...current.settings, notifications: false } }
        : current);
    }, [commit])
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : state.settings.theme);
    document.body.dataset.layout = state.settings.layout || 'default';
  }, [state.settings.theme, state.settings.layout]);

  useEffect(() => {
    const apply = (showToast = false) => {
      commit((current) => {
        const { state: next, result } = processDayChange(current);
        if (!result.changed && current.lastActiveDate === next.lastActiveDate) return current;
        if (showToast && result.changed) {
          toast(result.skippedDays > 1 ? `${result.skippedDays} days archived - habits refreshed for today!` : 'New day - habits refreshed for today!', 'info', 4500);
        }
        return next;
      });
    };
    const interval = window.setInterval(() => apply(false), 30000);
    const midnight = window.setTimeout(() => apply(true), msUntilMidnight() + 1500);
    const onVisible = () => document.visibilityState === 'visible' && apply(false);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(midnight);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [commit, toast]);

  useEffect(() => {
    if (consumeFreshStartToastFlag()) {
      toast('Fresh start! All stats are zero - begin tracking from today.', 'success', 5000);
    }
  }, [toast]);

  const quote = QUOTES[state.quoteIndex % QUOTES.length];
  const value = useMemo(() => ({ state, ui, auth, actions, quote }), [state, ui, auth, actions, quote]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
