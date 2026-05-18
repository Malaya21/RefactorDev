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

function logNoteService(message, details = null) {
  if (details === null) {
    console.info(`[ReflectFlow Firestore] ${message}`);
    return;
  }
  console.info(`[ReflectFlow Firestore] ${message}`, details);
}

/**
 * Load all notes for a specific user from Firestore
 * @param {string} uid - Firebase user ID
 * @returns {Promise<Array>} Notes array, empty if error
 */
export async function loadNotes(uid) {
  if (!uid) return [];
  try {
    logNoteService('Fetching notes started', { uid, path: `users/${uid}/notes` });
    const notesRef = collection(db, 'users', uid, 'notes');
    const q = query(notesRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logNoteService('Fetching notes completed', { uid, path: `users/${uid}/notes`, count: notes.length });
    return notes;
  } catch (error) {
    console.warn(`Failed to load notes for user ${uid}:`, error);
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
    logNoteService('Saving note', { uid, path: `users/${uid}/notes/${note.id}` });
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
    logNoteService('Deleting note', { uid, path: `users/${uid}/notes/${noteId}` });
    const noteRef = doc(db, 'users', uid, 'notes', noteId);
    await deleteDoc(noteRef);
  } catch (error) {
    console.error(`Failed to delete note for user ${uid}:`, error);
    throw error;
  }
}

/**
 * Delete all notes for a specific user.
 * @param {string} uid - Firebase user ID
 * @throws {Error} If Firestore delete fails
 */
export async function deleteAllNotes(uid) {
  if (!uid) {
    throw new Error('Invalid user ID');
  }

  logNoteService('Deleting all notes', { uid, path: `users/${uid}/notes` });
  const snapshot = await getDocs(collection(db, 'users', uid, 'notes'));
  const batch = writeBatch(db);
  snapshot.docs.forEach((noteDoc) => batch.delete(noteDoc.ref));
  await batch.commit();
}

