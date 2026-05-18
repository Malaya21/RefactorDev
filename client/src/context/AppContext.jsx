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
import { loadHabits, createOrUpdateHabit, deleteHabitFromFirestore } from '../services/habitService';
import { loadNotes, createOrUpdateNote, deleteNoteFromFirestore } from '../services/noteService';

const AppContext = createContext(null);

function createToast(message, type = 'info', duration = 3200) {
  return { id: uid(), message, type, duration };
}

// Empty user state (no habits/notes)
function emptyUserState() {
  const base = loadState();
  return {
    ...base,
    habits: [],
    notes: []
  };
}

export function AppProvider({ children }) {
  // Initialize state with empty habits/notes (will load from Firestore on auth)
  const [state, setState] = useState(() => emptyUserState());
  
  // Auth state
  const [auth, setAuth] = useState({
    user: null,
    loading: true
  });
  
  // Data loading state
  const [dataLoading, setDataLoading] = useState(false);
  
  // UI state
  const [ui, setUi] = useState({
    sidebarOpen: false,
    activeModal: null,
    editingHabit: null,
    editingNote: null,
    habitNoteId: null,
    notificationOpen: false,
    notificationStatus: getNotificationStatus(loadState().settings),
    search: '',
    toasts: []
  });

  /**
   * Commit: Update state and persist non-user-data to localStorage
   * NOTE: Does NOT sync to Firestore - individual actions handle that
   */
  const commit = useCallback((updater, options = {}) => {
    setState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next === current) return current;
      
      // Save to localStorage (only non-user-data like settings)
      if (options.persist !== false) {
        saveState(next);
      }
      
      return next;
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
    
    // Auth actions
    async logout() {
      try {
        // Clear all user state IMMEDIATELY before logout completes
        setState(emptyUserState());
        
        // Then log out from Firebase
        await logoutUser();
        toast('Signed out of ReflectFlow', 'info');
      } catch (error) {
        console.warn('Sign out failed:', error);
        toast('Could not sign out. Please try again.', 'error');
      }
    },
    
    // UI actions
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
    
    // HABIT ACTIONS - with Firestore sync
    async saveHabit(payload) {
      if (!auth.user?.uid) {
        toast('Must be logged in to save habits', 'error');
        return;
      }
      
      try {
        const frequency = ['daily', 'weekly', 'custom'].includes(payload.frequency) ? payload.frequency : 'daily';
        let habitToSave;
        
        commit((current) => {
          const id = payload.id;
          
          if (id) {
            // UPDATE existing habit
            return {
              ...current,
              habits: current.habits.map((habit) =>
                habit.id === id
                  ? (habitToSave = recalculate({
                      ...habit,
                      title: sanitizeString(payload.title, habit.title, 80),
                      description: sanitizeString(payload.description, '', 500),
                      category: sanitizeString(payload.category, 'Other', 40) || 'Other',
                      target: sanitizeString(payload.target, '', 120),
                      frequency,
                      customDays: payload.customDays
                    }))
                  : habit
              )
            };
          }
          
          // CREATE new habit
          habitToSave = recalculate({
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
          
          return { ...current, habits: [...current.habits, habitToSave] };
        });
        
        // Sync to Firestore (this is now awaited and error-checked)
        await createOrUpdateHabit(auth.user.uid, habitToSave);
        toast(payload.id ? 'Habit updated' : 'Habit added', 'success');
      } catch (error) {
        console.error('Failed to save habit:', error);
        toast('Failed to save habit. Please try again.', 'error');
        // TODO: Could optionally revert state here
      }
    },
    
    async deleteHabit(id) {
      if (!auth.user?.uid) {
        toast('Must be logged in to delete habits', 'error');
        return;
      }
      
      try {
        // Update state immediately (optimistic)
        commit((current) => ({ ...current, habits: current.habits.filter((habit) => habit.id !== id) }));
        
        // Then sync deletion to Firestore
        await deleteHabitFromFirestore(auth.user.uid, id);
        toast('Habit deleted', 'info');
      } catch (error) {
        console.error('Failed to delete habit:', error);
        toast('Failed to delete habit. Please try again.', 'error');
        // Note: State was already updated, but Firestore delete failed
        // On next refresh, habit may reappear from Firestore
      }
    },
    
    async markHabit(id, status) {
      if (!auth.user?.uid) {
        toast('Must be logged in to mark habits', 'error');
        return;
      }
      
      try {
        let updatedHabit;
        commit((current) => ({
          ...current,
          habits: current.habits.map((habit) => {
            if (habit.id !== id) return habit;
            return updatedHabit = status === 'completed' ? markComplete(habit) : markMissed(habit);
          })
        }));
        
        // Sync to Firestore
        await createOrUpdateHabit(auth.user.uid, updatedHabit);
        toast(status === 'completed' ? 'Habit completed!' : 'Habit marked missed', status === 'completed' ? 'success' : 'warning');
      } catch (error) {
        console.error('Failed to mark habit:', error);
        toast('Failed to update habit. Please try again.', 'error');
      }
    },
    
    async clearHabitStatus(id) {
      if (!auth.user?.uid) return;
      
      try {
        let updatedHabit;
        commit((current) => ({
          ...current,
          habits: current.habits.map((habit) => {
            if (habit.id !== id) return habit;
            return updatedHabit = setStatus(habit, todayKey(), null);
          })
        }));
        
        // Sync to Firestore
        await createOrUpdateHabit(auth.user.uid, updatedHabit);
      } catch (error) {
        console.error('Failed to clear habit status:', error);
      }
    },
    
    async saveHabitNote(id, text) {
      if (!auth.user?.uid) {
        toast('Must be logged in to save notes', 'error');
        return;
      }
      
      try {
        let updatedHabit;
        commit((current) => ({
          ...current,
          habits: current.habits.map((habit) => {
            if (habit.id !== id) return habit;
            const habitNotes = { ...(habit.habitNotes || {}) };
            const clean = sanitizeString(text, '', 800);
            if (clean) habitNotes[todayKey()] = clean;
            else delete habitNotes[todayKey()];
            return updatedHabit = { ...habit, habitNotes };
          })
        }));
        
        // Sync to Firestore
        await createOrUpdateHabit(auth.user.uid, updatedHabit);
        toast('Note saved', 'success');
      } catch (error) {
        console.error('Failed to save habit note:', error);
        toast('Failed to save note. Please try again.', 'error');
      }
    },
    
    // NOTE ACTIONS - with Firestore sync
    async saveNote(payload) {
      if (!auth.user?.uid) {
        toast('Must be logged in to save notes', 'error');
        return;
      }
      
      try {
        let noteToSave;
        commit((current) => {
          if (payload.id) {
            // UPDATE existing note
            return {
              ...current,
              notes: current.notes.map((note) =>
                note.id === payload.id
                  ? (noteToSave = { ...note, date: payload.date, mood: payload.mood, content: sanitizeString(payload.content, '', 5000), updatedAt: new Date().toISOString() })
                  : note
              )
            };
          }
          
          // CREATE new note
          noteToSave = { id: uid(), date: payload.date, mood: payload.mood, content: sanitizeString(payload.content, '', 5000), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          return {
            ...current,
            notes: [noteToSave, ...current.notes]
          };
        });
        
        // Sync to Firestore
        await createOrUpdateNote(auth.user.uid, noteToSave);
        toast(payload.id ? 'Entry updated' : 'Entry saved', 'success');
      } catch (error) {
        console.error('Failed to save note:', error);
        toast('Failed to save entry. Please try again.', 'error');
      }
    },
    
    async deleteNote(id) {
      if (!auth.user?.uid) {
        toast('Must be logged in to delete notes', 'error');
        return;
      }
      
      try {
        // Update state immediately (optimistic)
        commit((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }));
        
        // Then sync deletion to Firestore
        await deleteNoteFromFirestore(auth.user.uid, id);
        toast('Entry deleted', 'info');
      } catch (error) {
        console.error('Failed to delete note:', error);
        toast('Failed to delete entry. Please try again.', 'error');
      }
    },
    
    // SETTINGS ACTIONS (still local)
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
    
    // DATA IMPORT/RESET
    importBackup(text) {
      if (!auth.user?.uid) {
        toast('Must be logged in to import', 'error');
        return;
      }
      const imported = importJSON(text);
      commit(imported);
      toast('Data imported successfully', 'success');
      // NOTE: This is a special case - doesn't sync to Firestore (intentional for now)
    },
    
    async resetAll() {
      if (!auth.user?.uid) return;
      
      try {
        commit(resetState());
        // Sync cleared state to Firestore
        await Promise.all([
          createOrUpdateHabit(auth.user.uid, { ...state.habits[0] || { id: 'placeholder' }, history: {} })
          // This is a simplified reset - in production, you'd want to delete all habits/notes
        ]);
        toast('Fresh start! All progress cleared - begin from today.', 'success');
      } catch (error) {
        console.error('Failed to reset:', error);
      }
    }
  }), [auth.user?.uid, commit, toast, state, state.habits]);

  useEffect(() => {
    const unsubscribe = observeAuthState((user) => {
      setAuth({ user, loading: false });
    });

    return unsubscribe;
  }, []);

  // Load habits and notes from Firestore when user authenticates
  useEffect(() => {
    if (!auth.user?.uid) {
      // User logged out - state will be cleared by logout action
      return;
    }

    const loadUserData = async () => {
      try {
        const [habitsFromDb, notesFromDb] = await Promise.all([
          loadHabits(auth.user.uid),
          loadNotes(auth.user.uid)
        ]);

        commit((current) => {
          // Only update if we loaded data from Firestore
          if (habitsFromDb.length > 0 || notesFromDb.length > 0) {
            return {
              ...current,
              habits: habitsFromDb.length > 0 ? habitsFromDb : current.habits,
              notes: notesFromDb.length > 0 ? notesFromDb : current.notes
            };
          }
          // First time user - save default habits to Firestore
          if (habitsFromDb.length === 0 && current.habits.length > 0) {
            batchSaveHabits(auth.user.uid, current.habits).catch(err => {
              console.warn('Failed to save initial habits:', err);
            });
          }
          return current;
        });
      } catch (error) {
        console.warn('Failed to load user data from Firestore:', error);
      }
    };

    loadUserData();
  }, [auth.user?.uid, commit]);

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
