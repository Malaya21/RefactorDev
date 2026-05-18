import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';

function normalizeUser(user) {
  if (!user) return null;

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    createdAt: user.metadata?.creationTime || null,
    lastLoginAt: user.metadata?.lastSignInTime || null
  };
}

async function ensureLocalSession() {
  await setPersistence(auth, browserLocalPersistence);
}

export async function registerUser(email, password, displayName = '') {
  await ensureLocalSession();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }

  return normalizeUser(credential.user);
}

export async function loginUser(email, password) {
  await ensureLocalSession();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return normalizeUser(credential.user);
}

export async function logoutUser() {
  await signOut(auth);
}

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, (user) => callback(normalizeUser(user)));
}

export function getAuthErrorMessage(error) {
  const code = error?.code || '';

  const messages = {
    'auth/email-already-in-use': 'That email is already registered. Try logging in instead.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/wrong-password': 'Email or password is incorrect.'
  };

  return messages[code] || 'Authentication failed. Please try again.';
}
