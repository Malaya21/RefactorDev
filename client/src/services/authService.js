import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';
import { upsertAuthUserProfile } from './userService';

const LAST_LOGIN_METHOD_KEY = 'reflectflow_last_login_method';

function rememberLastLoginMethod(method) {
  try {
    localStorage.setItem(LAST_LOGIN_METHOD_KEY, method);
  } catch {
    // Auth still works if browser storage is unavailable.
  }
}

export function getLastLoginMethod() {
  try {
    return localStorage.getItem(LAST_LOGIN_METHOD_KEY) || '';
  } catch {
    return '';
  }
}

function normalizeUser(user) {
  if (!user) return null;

  const provider = user.providerData?.[0]?.providerId || 'password';

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    provider,
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

  await upsertAuthUserProfile(credential.user, 'password', { needsOnboarding: true });
  rememberLastLoginMethod('password');
  return normalizeUser(credential.user);
}

export async function loginUser(email, password) {
  await ensureLocalSession();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await upsertAuthUserProfile(credential.user, 'password');
  rememberLastLoginMethod('password');
  return normalizeUser(credential.user);
}

export async function loginWithGoogle() {
  await ensureLocalSession();

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const info = getAdditionalUserInfo(credential);
  await upsertAuthUserProfile(credential.user, 'google', { needsOnboarding: !!info?.isNewUser });
  rememberLastLoginMethod('google');

  return {
    user: normalizeUser(credential.user),
    isNewUser: !!info?.isNewUser
  };
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
    'auth/operation-not-allowed': 'Google sign-in is not enabled for this Firebase project.',
    'auth/popup-blocked': 'The Google sign-in popup was blocked. Allow popups and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/unauthorized-domain': 'This domain is not authorized for Firebase sign-in. Add it in Firebase Authentication settings.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/wrong-password': 'Email or password is incorrect.'
  };

  return messages[code] || 'Authentication failed. Please try again.';
}
