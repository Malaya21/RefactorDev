import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function createOrUpdateUserProfile(uid, profile) {
  if (!uid || !profile) {
    throw new Error('Invalid user profile payload');
  }
  const profileRef = doc(db, 'users', uid, 'profile');
  await setDoc(profileRef, profile, { merge: true });
  return profile;
}

export async function updateUserSettings(uid, settings) {
  if (!uid || !settings) {
    throw new Error('Invalid user settings payload');
  }
  const profileRef = doc(db, 'users', uid, 'profile');
  await setDoc(profileRef, { settings }, { merge: true });
  return settings;
}
