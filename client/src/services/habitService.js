import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';

/**
 * Load all habits for a specific user from Firestore
 * @param {string} uid - Firebase user ID
 * @returns {Promise<Array>} Habits array, empty if error
 */
export async function loadHabits(uid) {
  if (!uid) return [];
  try {
    const habitsRef = collection(db, 'users', uid, 'habits');
    const q = query(habitsRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.warn(`Failed to load habits for user ${uid}:`, error);
    return [];
  }
}

/**
 * Load all notes for a specific user from Firestore
 * @param {string} uid - Firebase user ID
 * @returns {Promise<Array>} Notes array, empty if error
 */
export async function loadNotes(uid) {
  if (!uid) return [];
  try {
    const notesRef = collection(db, 'users', uid, 'notes');
    const q = query(notesRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.warn(`Failed to load notes for user ${uid}:`, error);
    return [];
  }
}

/**
 * Create or update a single habit
 * @param {string} uid - Firebase user ID
 * @param {Object} habit - Habit object with id and all properties
 * @throws {Error} If Firestore write fails
 */
export async function createOrUpdateHabit(uid, habit) {
  if (!uid || !habit?.id) {
    throw new Error('Invalid user ID or habit');
  }
  try {
    const habitRef = doc(db, 'users', uid, 'habits', habit.id);
    await setDoc(habitRef, habit, { merge: false }); // merge: false = replace entire doc
    return habit;
  } catch (error) {
    console.error(`Failed to save habit for user ${uid}:`, error);
    throw error;
  }
}

/**
 * Delete a habit from Firestore
 * @param {string} uid - Firebase user ID
 * @param {string} habitId - Habit ID to delete
 * @throws {Error} If Firestore delete fails
 */
export async function deleteHabitFromFirestore(uid, habitId) {
  if (!uid || !habitId) {
    throw new Error('Invalid user ID or habit ID');
  }
  try {
    const habitRef = doc(db, 'users', uid, 'habits', habitId);
    await deleteDoc(habitRef);
  } catch (error) {
    console.error(`Failed to delete habit for user ${uid}:`, error);
    throw error;
  }
}

/**
 * Create or update a single note
 * @param {string} uid - Firebase user ID
 * @param {Object} note - Note object with id and all properties
 * @throws {Error} If Firestore write fails
 */
export async function createOrUpdateNote(uid, note) {
  if (!uid || !note?.id) {
    throw new Error('Invalid user ID or note');
  }
  try {
    const noteRef = doc(db, 'users', uid, 'notes', note.id);
    await setDoc(noteRef, note, { merge: false }); // merge: false = replace entire doc
    return note;
  } catch (error) {
    console.error(`Failed to save note for user ${uid}:`, error);
    throw error;
  }
}

/**
 * Delete a note from Firestore
 * @param {string} uid - Firebase user ID
 * @param {string} noteId - Note ID to delete
 * @throws {Error} If Firestore delete fails
 */
export async function deleteNoteFromFirestore(uid, noteId) {
  if (!uid || !noteId) {
    throw new Error('Invalid user ID or note ID');
  }
  try {
    const noteRef = doc(db, 'users', uid, 'notes', noteId);
    await deleteDoc(noteRef);
  } catch (error) {
    console.error(`Failed to delete note for user ${uid}:`, error);
    throw error;
  }
}

