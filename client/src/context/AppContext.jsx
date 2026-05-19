import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  consumeFreshStartToastFlag,
  createDefaultHabit,
  createDefaultHabits,
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
import { batchSaveHabits, createOrUpdateHabit, deleteAllHabits, deleteHabitFromFirestore, isValidFirestoreDocumentId, loadHabits } from '../services/habitService';
import { createOrUpdateNote, deleteAllNotes, deleteNoteFromFirestore, loadNotes } from '../services/noteService';
import { completeUserOnboarding, getUserProfile, markUserInitialized } from '../services/userService';
import { getHabitTemplatesForInterests } from '../data/habitTemplates';
import { awardHabitCompletionXP, DEFAULT_GAMIFICATION, ensureGamificationProfile, subscribeToGamification } from '../services/gamificationService';

const AppContext = createContext(null);
const CLOUD_RESTORE_TIMEOUT_MS = 10000;
const AUTH_RESTORE_TIMEOUT_MS = 10000;

function createToast(message, type = 'info', duration = 3200) {
  return { id: uid(), message, type, duration };
}

function logCloud(message, details = null) {
  if (details === null) {
    console.info(`[ReflectFlow sync] ${message}`);
    return;
  }
  console.info(`[ReflectFlow sync] ${message}`, details);
}

function warnCloud(message, error) {
  console.warn(`[ReflectFlow sync] ${message}`, error);
}

function withTimeout(promise, label, timeoutMs = CLOUD_RESTORE_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function getUserInitializedKey(userId) {
  return `reflectflow_initialized_${userId}`;
}

function hasLocalInitializedMarker(userId) {
  try {
    return localStorage.getItem(getUserInitializedKey(userId)) === '1';
  } catch {
    return false;
  }
}

function markLocalInitialized(userId) {
  try {
    localStorage.setItem(getUserInitializedKey(userId), '1');
  } catch {
    // Ignore unavailable storage; Firestore remains the source of truth.
  }
}

function shouldRequireOnboarding(profile, habits, notes, userId) {
  if (profile?.onboardingCompleted === true) return false;
  if (profile?.needsOnboarding === true || profile?.onboardingCompleted === false) return true;
  return !hasLocalInitializedMarker(userId) && habits.length === 0 && notes.length === 0;
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
  const stateRef = useRef(state);
  
  // Auth state
  const [auth, setAuth] = useState({
    user: null,
    loading: true,
    initialized: false,
    onboardingRequired: false,
    onboardingChecked: false
  });
  const authSessionRef = useRef(0);
  const habitWriteTokensRef = useRef(new Map());
  
  // Data loading state
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(false);
  const [gamification, setGamification] = useState(DEFAULT_GAMIFICATION);
  
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
    toasts: [],
    xpFeedback: []
  });

  const showXpFeedback = useCallback((amount, leveledUp = false) => {
    if (!amount) return;
    const item = { id: uid(), amount, leveledUp };
    setUi((current) => ({ ...current, xpFeedback: [...(current.xpFeedback || []), item] }));
    window.setTimeout(() => {
      setUi((current) => ({ ...current, xpFeedback: (current.xpFeedback || []).filter((entry) => entry.id !== item.id) }));
    }, 1500);
  }, []);

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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const syncUnavailable = dataLoading;

  const getHabitWriteBlockReason = useCallback(() => {
    if (!auth.initialized || auth.loading) return 'auth is still initializing';
    if (syncUnavailable) return 'cloud hydration is still running';
    if (!auth.user?.uid) return 'missing authenticated user';
    return null;
  }, [auth.initialized, auth.loading, auth.user?.uid, syncUnavailable]);

  const getNextHabitWriteToken = useCallback((habitId) => {
    const next = (habitWriteTokensRef.current.get(habitId) || 0) + 1;
    habitWriteTokensRef.current.set(habitId, next);
    return next;
  }, []);

  const isLatestHabitWrite = useCallback((habitId, token) => {
    return habitWriteTokensRef.current.get(habitId) === token;
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

    async finishOnboarding(interests) {
      const userId = auth.user?.uid;
      if (!userId) {
        toast('Must be logged in to finish onboarding', 'error');
        return false;
      }

      const cleanInterests = Array.isArray(interests) ? interests.filter(Boolean) : [];
      if (!cleanInterests.length) {
        toast('Choose at least one interest to build your starter habits.', 'warning');
        return false;
      }

      try {
        const starterHabits = getHabitTemplatesForInterests(cleanInterests).map((template, index) => recalculate(createDefaultHabit(index, {
          ...template,
          createdAt: new Date().toISOString(),
          order: index
        })));

        await Promise.all([
          completeUserOnboarding(userId, cleanInterests),
          ensureGamificationProfile(userId),
          starterHabits.length ? batchSaveHabits(userId, starterHabits) : Promise.resolve([])
        ]);

        markLocalInitialized(userId);
        setAuth((current) => ({
          ...current,
          onboardingRequired: false,
          onboardingChecked: true
        }));
        setState((current) => ({
          ...current,
          habits: starterHabits,
          notes: current.notes || []
        }));
        toast('Starter habits created. Welcome to your dashboard!', 'success');
        return true;
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
        toast('Could not finish onboarding. Please try again.', 'error', 5200);
        return false;
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
      const blockReason = getHabitWriteBlockReason();
      if (blockReason) {
        console.warn('[ReflectFlow habit write] saveHabit blocked', {
          reason: blockReason,
          authInitialized: auth.initialized,
          authLoading: auth.loading,
          uid: auth.user?.uid || null,
          habitId: payload?.id || null
        });
        toast(blockReason === 'missing authenticated user' ? 'Must be logged in to save habits' : 'Still syncing your data. Please try again in a moment.', 'warning');
        return;
      }

      const userId = auth.user?.uid;
      
      try {
        const frequency = ['daily', 'weekly', 'custom'].includes(payload.frequency) ? payload.frequency : 'daily';
        let habitToSave;
        
        let habitWasFound = false;
        commit((current) => {
          const id = payload.id;
          
          if (id) {
            // UPDATE existing habit
            return {
              ...current,
              habits: current.habits.map((habit) =>
                habit.id === id
                  ? (habitWasFound = true, habitToSave = recalculate({
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

        if (payload.id && !habitWasFound) {
          throw new Error('Habit was not found in the current user state');
        }

        if (!isValidFirestoreDocumentId(habitToSave?.id)) {
          throw new Error(`Invalid habit document ID: ${String(habitToSave?.id)}`);
        }
        
        // Sync to Firestore (this is now awaited and error-checked)
        await createOrUpdateHabit(userId, habitToSave);
        toast(payload.id ? 'Habit updated' : 'Habit added', 'success');
      } catch (error) {
        console.error('Failed to save habit:', error);
        toast('Failed to save habit. Please try again.', 'error');
        // TODO: Could optionally revert state here
      }
    },
    
    async deleteHabit(id) {
      const blockReason = getHabitWriteBlockReason();
      if (blockReason) {
        console.warn('[ReflectFlow habit write] deleteHabit blocked', {
          reason: blockReason,
          authInitialized: auth.initialized,
          authLoading: auth.loading,
          uid: auth.user?.uid || null,
          habitId: id
        });
        toast(blockReason === 'missing authenticated user' ? 'Must be logged in to delete habits' : 'Still syncing your data. Please try again in a moment.', 'warning');
        return;
      }

      const userId = auth.user?.uid;
      if (!isValidFirestoreDocumentId(id)) {
        console.error('[ReflectFlow habit write] Invalid habit ID for delete', { uid: userId, habitId: id });
        toast('Could not delete habit because its document ID is invalid.', 'error');
        return;
      }
      
      try {
        await deleteHabitFromFirestore(userId, id);
        commit((current) => ({ ...current, habits: current.habits.filter((habit) => habit.id !== id) }));
        toast('Habit deleted', 'info');
      } catch (error) {
        console.error('Failed to delete habit:', error);
        toast('Failed to delete habit. Please try again.', 'error');
        // Note: State was already updated, but Firestore delete failed
        // On next refresh, habit may reappear from Firestore
      }
    },
    
    async markHabit(id, status) {
      const blockReason = getHabitWriteBlockReason();
      if (blockReason) {
        console.warn('[ReflectFlow habit write] markHabit blocked', {
          reason: blockReason,
          authInitialized: auth.initialized,
          authLoading: auth.loading,
          uid: auth.user?.uid || null,
          habitId: id,
          status
        });
        toast(blockReason === 'missing authenticated user' ? 'Must be logged in to mark habits' : 'Still syncing your data. Please try again in a moment.', 'warning');
        return;
      }

      const userId = auth.user?.uid;
      if (!isValidFirestoreDocumentId(id)) {
        console.error('[ReflectFlow habit write] Invalid habit ID for status update', { uid: userId, habitId: id, status });
        toast('Could not update status because this habit has an invalid document ID.', 'error');
        return;
      }
      
      const writeToken = getNextHabitWriteToken(id);
      const previousHabit = stateRef.current.habits.find((habit) => habit.id === id) || null;
      const updatedHabit = previousHabit
        ? (status === 'completed' ? markComplete(previousHabit) : markMissed(previousHabit))
        : null;

      try {
        if (!updatedHabit) {
          throw new Error('Habit was not found in the current user state');
        }

        commit((current) => ({
          ...current,
          habits: current.habits.map((habit) => habit.id === id ? updatedHabit : habit)
        }));

        console.info('[ReflectFlow habit write] Status update prepared', {
          uid: userId,
          habitId: id,
          path: `users/${userId}/habits/${id}`,
          status,
          payload: updatedHabit
        });
        
        await createOrUpdateHabit(userId, updatedHabit);
        if (status === 'completed') {
          try {
            const habitsAfterCompletion = stateRef.current.habits.map((habit) => habit.id === id ? updatedHabit : habit);
            const xpResult = await awardHabitCompletionXP(userId, {
              habitBefore: previousHabit,
              habitAfter: updatedHabit,
              habitsAfterCompletion,
              dateKey: todayKey()
            });
            if (xpResult.awardedXP) {
              showXpFeedback(xpResult.awardedXP, xpResult.leveledUp);
              if (xpResult.leveledUp) {
                toast(`Level up! You reached Level ${xpResult.currentLevel}.`, 'success', 5200);
              }
            }
          } catch (error) {
            warnCloud('XP award failed after habit completion', error);
          }
        }
        console.info('[ReflectFlow habit write] Status update persisted', {
          uid: userId,
          habitId: id,
          path: `users/${userId}/habits/${id}`,
          status
        });
        toast(status === 'completed' ? 'Habit completed!' : 'Habit marked missed', status === 'completed' ? 'success' : 'warning');
      } catch (error) {
        console.error('[ReflectFlow habit write] Failed to persist status update', {
          uid: userId,
          habitId: id,
          path: `users/${userId}/habits/${id}`,
          status,
          payload: updatedHabit,
          error
        });

        if (previousHabit && isLatestHabitWrite(id, writeToken)) {
          commit((current) => ({
            ...current,
            habits: current.habits.map((habit) => habit.id === id ? previousHabit : habit)
          }));
          console.info('[ReflectFlow habit write] Rolled back failed status update', {
            uid: userId,
            habitId: id,
            path: `users/${userId}/habits/${id}`,
            status
          });
        }

        toast('Failed to update status. Please try again.', 'error');
      }
    },
    
    async clearHabitStatus(id) {
      if (getHabitWriteBlockReason()) return;
      if (!isValidFirestoreDocumentId(id)) return;
      
      try {
        let updatedHabit;
        commit((current) => ({
          ...current,
          habits: current.habits.map((habit) => {
            if (habit.id !== id) return habit;
            return updatedHabit = setStatus(habit, todayKey(), null);
          })
        }));

        if (!updatedHabit) return;
        
        // Sync to Firestore
        await createOrUpdateHabit(auth.user.uid, updatedHabit);
      } catch (error) {
        console.error('Failed to clear habit status:', error);
      }
    },
    
    async saveHabitNote(id, text) {
      const blockReason = getHabitWriteBlockReason();
      if (blockReason) {
        console.warn('[ReflectFlow habit write] saveHabitNote blocked', {
          reason: blockReason,
          authInitialized: auth.initialized,
          authLoading: auth.loading,
          uid: auth.user?.uid || null,
          habitId: id
        });
        toast(blockReason === 'missing authenticated user' ? 'Must be logged in to save notes' : 'Still syncing your data. Please try again in a moment.', 'warning');
        return;
      }

      const userId = auth.user?.uid;
      if (!isValidFirestoreDocumentId(id)) {
        console.error('[ReflectFlow habit write] Invalid habit ID for habit note', { uid: userId, habitId: id });
        toast('Could not save note because this habit has an invalid document ID.', 'error');
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

        if (!updatedHabit) {
          throw new Error('Habit was not found in the current user state');
        }
        
        // Sync to Firestore
        await createOrUpdateHabit(userId, updatedHabit);
        toast('Note saved', 'success');
      } catch (error) {
        console.error('Failed to save habit note:', error);
        toast('Failed to save note. Please try again.', 'error');
      }
    },
    
    // NOTE ACTIONS - with Firestore sync
    async saveNote(payload) {
      if (syncUnavailable) {
        toast('Still syncing your data. Please try again in a moment.', 'warning');
        return;
      }

      const userId = auth.user?.uid;
      if (!userId) {
        toast('Must be logged in to save notes', 'error');
        return;
      }
      
      try {
        let noteToSave;
        let noteWasFound = false;
        commit((current) => {
          if (payload.id) {
            // UPDATE existing note
            return {
              ...current,
              notes: current.notes.map((note) =>
                note.id === payload.id
                  ? (noteWasFound = true, noteToSave = { ...note, date: payload.date, mood: payload.mood, content: sanitizeString(payload.content, '', 5000), updatedAt: new Date().toISOString() })
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

        if (payload.id && !noteWasFound) {
          throw new Error('Note was not found in the current user state');
        }
        
        // Sync to Firestore
        await createOrUpdateNote(userId, noteToSave);
        toast(payload.id ? 'Entry updated' : 'Entry saved', 'success');
      } catch (error) {
        console.error('Failed to save note:', error);
        toast('Failed to save entry. Please try again.', 'error');
      }
    },
    
    async deleteNote(id) {
      if (syncUnavailable) {
        toast('Still syncing your data. Please try again in a moment.', 'warning');
        return;
      }

      const userId = auth.user?.uid;
      if (!userId) {
        toast('Must be logged in to delete notes', 'error');
        return;
      }
      
      try {
        await deleteNoteFromFirestore(userId, id);
        commit((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }));
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
      if (syncUnavailable || !auth.user?.uid) {
        toast('Must be logged in to import', 'error');
        return;
      }
      const imported = importJSON(text);
      commit(imported);
      toast('Data imported successfully', 'success');
      // NOTE: This is a special case - doesn't sync to Firestore (intentional for now)
    },
    
    async resetAll() {
      if (syncUnavailable || !auth.user?.uid) return;
      
      try {
        const nextState = resetState();
        await Promise.all([
          deleteAllHabits(auth.user.uid),
          deleteAllNotes(auth.user.uid)
        ]);
        await batchSaveHabits(auth.user.uid, nextState.habits);
        markUserInitialized(auth.user.uid).catch((error) => {
          warnCloud('Optional user initialization marker write failed', error);
        });
        markLocalInitialized(auth.user.uid);
        saveState(nextState);
        setState(nextState);
        toast('Fresh start! All progress cleared - begin from today.', 'success');
      } catch (error) {
        console.error('Failed to reset:', error);
        toast('Failed to reset data. Please try again.', 'error');
      }
    }
  }), [auth.initialized, auth.loading, auth.user?.uid, commit, getHabitWriteBlockReason, getNextHabitWriteToken, isLatestHabitWrite, showXpFeedback, syncUnavailable, toast]);

  useEffect(() => {
    let active = true;
    let authResolved = false;

    const authTimeout = window.setTimeout(() => {
      if (!active || authResolved) return;
      warnCloud('Auth state restore timed out; continuing unauthenticated', { timeoutMs: AUTH_RESTORE_TIMEOUT_MS });
      authResolved = true;
      authSessionRef.current += 1;
      logCloud('Auth initialized', { uid: null, timedOut: true });
      setAuth({ user: null, loading: false, initialized: true, onboardingRequired: false, onboardingChecked: true });
      setDataLoading(false);
      setDataError(false);
      setGamification(DEFAULT_GAMIFICATION);
      setState(emptyUserState());
    }, AUTH_RESTORE_TIMEOUT_MS);

    const unsubscribe = observeAuthState((user) => {
      authResolved = true;
      window.clearTimeout(authTimeout);
      const sessionId = authSessionRef.current + 1;
      authSessionRef.current = sessionId;
      logCloud('Auth state restored', { sessionId, uid: user?.uid || null, email: user?.email || null });
      logCloud('Auth initialized', { uid: user?.uid || null, hasUser: !!user });
      setAuth({ user, loading: false, initialized: true, onboardingRequired: false, onboardingChecked: !user?.uid });

      if (!user?.uid) {
        logCloud('No authenticated user; clearing user state', { sessionId });
        setDataLoading(false);
        setDataError(false);
        setGamification(DEFAULT_GAMIFICATION);
        setState(emptyUserState());
        return;
      }

      setDataLoading(true);
      setDataError(false);
      setState(emptyUserState());
      logCloud('Firestore hydration started', {
        sessionId,
        uid: user.uid,
        paths: [`users/${user.uid}/habits`, `users/${user.uid}/notes`],
        timeoutMs: CLOUD_RESTORE_TIMEOUT_MS
      });

      Promise.allSettled([
        withTimeout(getUserProfile(user.uid), 'Load user profile'),
        withTimeout(loadHabits(user.uid), 'Load habits'),
        withTimeout(loadNotes(user.uid), 'Load notes')
      ]).then(async ([profileResult, habitsResult, notesResult]) => {
        if (!active || authSessionRef.current !== sessionId) return;

        const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
        const habitsFromDb = habitsResult.status === 'fulfilled' ? habitsResult.value : [];
        const notesFromDb = notesResult.status === 'fulfilled' ? notesResult.value : [];
        const failedLoads = [habitsResult, notesResult].filter((result) => result.status === 'rejected');
        const hadCloudError = failedLoads.length > 0;

        if (profileResult.status === 'rejected') {
          warnCloud('Firestore profile fetch failed', profileResult.reason);
        }

        if (habitsResult.status === 'rejected') {
          warnCloud('Firestore habits fetch failed', habitsResult.reason);
        } else {
          logCloud('Firestore habits fetch completed', { sessionId, uid: user.uid, count: habitsFromDb.length });
        }

        if (notesResult.status === 'rejected') {
          warnCloud('Firestore notes fetch failed', notesResult.reason);
        } else {
          logCloud('Firestore notes fetch completed', { sessionId, uid: user.uid, count: notesFromDb.length });
        }

        const shouldSeedDefaults = !hadCloudError
          && !shouldRequireOnboarding(profile, habitsFromDb, notesFromDb, user.uid)
          && !hasLocalInitializedMarker(user.uid)
          && habitsFromDb.length === 0
          && notesFromDb.length === 0;
        const habits = shouldSeedDefaults ? createDefaultHabits() : habitsFromDb;
        const onboardingRequired = !hadCloudError && shouldRequireOnboarding(profile, habitsFromDb, notesFromDb, user.uid);

        setState((current) => ({
          ...current,
          habits,
          notes: notesFromDb
        }));

        setAuth((current) => current.user?.uid === user.uid
          ? { ...current, onboardingRequired, onboardingChecked: true }
          : current);

        if (onboardingRequired) {
          logCloud('Onboarding required before starter habit generation', { sessionId, uid: user.uid });
        } else if (shouldSeedDefaults) {
          logCloud('Seeding default habits for first local initialization', { sessionId, uid: user.uid, count: habits.length });
          try {
            await withTimeout(batchSaveHabits(user.uid, habits), 'Seed default habits');
            markLocalInitialized(user.uid);
            markUserInitialized(user.uid).catch((error) => {
              warnCloud('Optional user initialization marker write failed', error);
            });
            logCloud('Default habit seed completed', { sessionId, uid: user.uid });
          } catch (error) {
            warnCloud('Default habit seed failed; continuing with local defaults', error);
            toast('Cloud sync had a problem. You can keep using ReflectFlow while it reconnects.', 'warning', 6000);
          }
        } else if (!hadCloudError) {
          markLocalInitialized(user.uid);
        }

        setDataError(hadCloudError);
        if (hadCloudError) {
          toast('Cloud sync had a problem. You can keep using ReflectFlow while it reconnects.', 'warning', 6000);
        }
        logCloud('Hydration completed', {
          sessionId,
          uid: user.uid,
          habits: habits.length,
          notes: notesFromDb.length,
          cloudError: hadCloudError,
          seededDefaults: shouldSeedDefaults
        });
      }).catch((error) => {
        warnCloud('Unexpected hydration failure', error);
        setDataError(true);
        toast('Cloud sync had a problem. You can keep using ReflectFlow while it reconnects.', 'warning', 6000);
      }).finally(() => {
        if (active && authSessionRef.current === sessionId) {
          logCloud('Hydration loading state cleared', { sessionId, uid: user.uid });
          setDataLoading(false);
        }
      });
    });

    return () => {
      active = false;
      window.clearTimeout(authTimeout);
      unsubscribe();
    };
  }, [toast]);

  useEffect(() => {
    const userId = auth.user?.uid;
    if (!userId) {
      setGamification(DEFAULT_GAMIFICATION);
      return undefined;
    }

    ensureGamificationProfile(userId).catch((error) => {
      warnCloud('Gamification profile initialization failed', error);
    });

    return subscribeToGamification(userId, setGamification, (error) => {
      warnCloud('Gamification realtime listener failed', error);
      setGamification(DEFAULT_GAMIFICATION);
    });
  }, [auth.user?.uid]);

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
  const value = useMemo(() => ({ state, ui, auth, gamification, dataLoading, dataError, actions, quote }), [state, ui, auth, gamification, dataLoading, dataError, actions, quote]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
