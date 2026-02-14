// src/firebase/auth.js
import { auth } from './firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';

// Listen to auth state (already used in AuthContext, but can be reused)
export const onAuthChanged = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Login with license number (creates email pattern)
export const loginWithLicense = async (licenseNumber, password) => {
  const email = `${licenseNumber.toLowerCase().trim()}@fake.ltms.com`;
  return signInWithEmailAndPassword(auth, email, password);
};

// Logout
export const logout = async () => {
  return signOut(auth);
};

// Change password (used for first-time reset)
export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  // Re-authenticate first (Firebase security requirement)
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  return updatePassword(user, newPassword);
};

// Get current user (sync)
export const getCurrentUser = () => auth.currentUser;