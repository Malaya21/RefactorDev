import { db } from '../firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

const USER_SCHEMA_VERSION = 1;

export async function getUserProfile(uid) {
  if (!uid) {
    throw new Error('Invalid user ID');
  }

  const profileRef = doc(db, 'users', uid);
  const snapshot = await getDoc(profileRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function markUserInitialized(uid) {
  if (!uid) {
    throw new Error('Invalid user ID');
  }

  const profileRef = doc(db, 'users', uid);
  await setDoc(profileRef, {
    initializedAt: serverTimestamp(),
    schemaVersion: USER_SCHEMA_VERSION
  }, { merge: true });
}

export async function createOrUpdateUserProfile(uid, profile) {
  if (!uid || !profile) {
    throw new Error('Invalid user profile payload');
  }
  const profileRef = doc(db, 'users', uid);
  await setDoc(profileRef, profile, { merge: true });
  return profile;
}

export async function updateUserSettings(uid, settings) {
  if (!uid || !settings) {
    throw new Error('Invalid user settings payload');
  }
  const profileRef = doc(db, 'users', uid);
  await setDoc(profileRef, { settings }, { merge: true });
  return settings;
}
