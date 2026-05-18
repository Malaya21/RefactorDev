import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  setDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';

function logHabitService(message, details = null) {
  if (details === null) {
    console.info(`[ReflectFlow Firestore] ${message}`);
    return;
  }
  console.info(`[ReflectFlow Firestore] ${message}`, details);
}

export function isValidFirestoreDocumentId(id) {
  return typeof id === 'string'
    && id.trim().length > 0
    && id.length <= 1500
    && !id.includes('/');
}

function assertValidUserAndHabitId(uid, habitId) {
  if (!uid) {
    throw new Error('Missing authenticated user ID for habit write');
  }
  if (!isValidFirestoreDocumentId(habitId)) {
    throw new Error(`Invalid Firestore habit document ID: ${String(habitId)}`);
  }
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((out, [key, nested]) => {
      if (nested !== undefined) {
        out[key] = stripUndefined(nested);
      }
      return out;
    }, {});
  }

  return value;
}

function toFirestoreHabit(habit) {
  return stripUndefined(habit);
}

/**
 * Load all habits for a specific user from Firestore
 * @param {string} uid - Firebase user ID
 * @returns {Promise<Array>} Habits array, empty if error
 */
export async function loadHabits(uid) {
  if (!uid) return [];
  try {
    logHabitService('Fetching habits started', { uid, path: `users/${uid}/habits` });
    const habitsRef = collection(db, 'users', uid, 'habits');
    const q = query(habitsRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    const habits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logHabitService('Fetching habits completed', { uid, path: `users/${uid}/habits`, count: habits.length });
    return habits;
  } catch (error) {
    console.warn(`Failed to load habits for user ${uid}:`, error);
    throw error;
  }
}

/**
 * Create or update a single habit
 * @param {string} uid - Firebase user ID
 * @param {Object} habit - Habit object with id and all properties
 * @throws {Error} If Firestore write fails
 */
export async function createOrUpdateHabit(uid, habit) {
  assertValidUserAndHabitId(uid, habit?.id);

  const payload = toFirestoreHabit(habit);
  const path = `users/${uid}/habits/${habit.id}`;

  try {
    logHabitService('Saving habit', {
      uid,
      habitId: habit.id,
      path,
      payload
    });
    const habitRef = doc(db, 'users', uid, 'habits', habit.id);
    await setDoc(habitRef, payload, { merge: false }); // merge: false = replace entire doc
    logHabitService('Habit save completed', { uid, habitId: habit.id, path });
    return payload;
  } catch (error) {
    console.error(`Failed to save habit for user ${uid} at ${path}:`, error);
    throw error;
  }
}

/**
 * Save multiple habits for a specific user in a single batch.
 * @param {string} uid - Firebase user ID
 * @param {Array<Object>} habits - Habit objects with ids
 * @throws {Error} If Firestore write fails
 */
export async function batchSaveHabits(uid, habits) {
  if (!uid || !Array.isArray(habits)) {
    throw new Error('Invalid user ID or habits');
  }

  logHabitService('Batch saving habits', { uid, path: `users/${uid}/habits`, count: habits.length });
  const batch = writeBatch(db);
  habits.forEach((habit) => {
    assertValidUserAndHabitId(uid, habit?.id);
    batch.set(doc(db, 'users', uid, 'habits', habit.id), toFirestoreHabit(habit));
  });
  await batch.commit();
  return habits;
}

/**
 * Delete a habit from Firestore
 * @param {string} uid - Firebase user ID
 * @param {string} habitId - Habit ID to delete
 * @throws {Error} If Firestore delete fails
 */
export async function deleteHabitFromFirestore(uid, habitId) {
  assertValidUserAndHabitId(uid, habitId);
  const path = `users/${uid}/habits/${habitId}`;

  try {
    logHabitService('Deleting habit', { uid, habitId, path });
    const habitRef = doc(db, 'users', uid, 'habits', habitId);
    await deleteDoc(habitRef);
    logHabitService('Habit delete completed', { uid, habitId, path });
  } catch (error) {
    console.error(`Failed to delete habit for user ${uid} at ${path}:`, error);
    throw error;
  }
}

/**
 * Delete all habits for a specific user.
 * @param {string} uid - Firebase user ID
 * @throws {Error} If Firestore delete fails
 */
export async function deleteAllHabits(uid) {
  if (!uid) {
    throw new Error('Invalid user ID');
  }

  logHabitService('Deleting all habits', { uid, path: `users/${uid}/habits` });
  const snapshot = await getDocs(collection(db, 'users', uid, 'habits'));
  const batch = writeBatch(db);
  snapshot.docs.forEach((habitDoc) => batch.delete(habitDoc.ref));
  await batch.commit();
}

