import { db } from '../firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

const USER_SCHEMA_VERSION = 1;
const PROFILE_DOC_ID = 'main';

function rootUserRef(uid) {
  return doc(db, 'users', uid);
}

function profileRef(uid) {
  return doc(db, 'users', uid, 'profile', PROFILE_DOC_ID);
}

function preferencesRef(uid) {
  return doc(db, 'users', uid, 'preferences', 'main');
}

export async function getUserProfile(uid) {
  if (!uid) {
    throw new Error('Invalid user ID');
  }

  const nestedProfile = await getDoc(profileRef(uid));
  if (nestedProfile.exists()) return nestedProfile.data();

  const rootProfile = await getDoc(rootUserRef(uid));
  return rootProfile.exists() ? rootProfile.data() : null;
}

export async function markUserInitialized(uid) {
  if (!uid) {
    throw new Error('Invalid user ID');
  }

  await setDoc(rootUserRef(uid), {
    initializedAt: serverTimestamp(),
    schemaVersion: USER_SCHEMA_VERSION
  }, { merge: true });
}

export async function createOrUpdateUserProfile(uid, profile) {
  if (!uid || !profile) {
    throw new Error('Invalid user profile payload');
  }
  await Promise.all([
    setDoc(rootUserRef(uid), profile, { merge: true }),
    setDoc(profileRef(uid), profile, { merge: true })
  ]);
  return profile;
}

export async function upsertAuthUserProfile(user, provider = 'password', options = {}) {
  if (!user?.uid) {
    throw new Error('Invalid authenticated user profile payload');
  }

  const snapshot = await getDoc(profileRef(user.uid));
  const profile = {
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    provider,
    lastLoginAt: serverTimestamp()
  };

  if (!snapshot.exists()) {
    profile.createdAt = serverTimestamp();
  }

  if (options.needsOnboarding) {
    profile.needsOnboarding = true;
  }

  await createOrUpdateUserProfile(user.uid, profile);
  return profile;
}

export async function saveUserPreferences(uid, preferences) {
  if (!uid || !preferences) {
    throw new Error('Invalid user preferences payload');
  }

  const payload = {
    interests: Array.isArray(preferences.interests) ? preferences.interests : [],
    updatedAt: serverTimestamp()
  };

  await Promise.all([
    setDoc(preferencesRef(uid), payload, { merge: true }),
    setDoc(rootUserRef(uid), { preferences: payload }, { merge: true })
  ]);
  return payload;
}

export async function completeUserOnboarding(uid, interests) {
  if (!uid) {
    throw new Error('Invalid user ID');
  }

  const profilePatch = {
    onboardingCompleted: true,
    needsOnboarding: false,
    onboardedAt: serverTimestamp()
  };

  await Promise.all([
    saveUserPreferences(uid, { interests }),
    createOrUpdateUserProfile(uid, profilePatch)
  ]);

  return profilePatch;
}

export async function updateUserSettings(uid, settings) {
  if (!uid || !settings) {
    throw new Error('Invalid user settings payload');
  }
  await setDoc(rootUserRef(uid), { settings }, { merge: true });
  return settings;
}
