// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db } from '../firebase/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { CODE_ADMIN_STORAGE_KEY } from '../config/credentials';

const FAKE_ADMIN_USER = { uid: 'code-admin', email: 'LTOAdmin@ltms.gov.ph' };

const AuthContext = createContext({
  currentUser: null,
  userRole: null,
  loading: true,
  logout: () => {},
  setCodeAdminUser: () => {},
});

async function resolveUserRole(uid) {
  const [adminSnap, officerSnap, ownerSnap, driverSnap] = await Promise.all([
    getDoc(doc(db, 'admins', uid)),
    getDoc(doc(db, 'officers', uid)),
    getDoc(doc(db, 'vehicleOwners', uid)),
    getDoc(doc(db, 'drivers', uid)),
  ]);
  if (adminSnap.exists()) return 'admin';
  if (officerSnap.exists()) return 'officer';
  if (ownerSnap.exists()) return 'owner';
  if (driverSnap.exists()) return 'driver';
  return null;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const setCodeAdminUser = useCallback(() => {
    try {
      sessionStorage.setItem(CODE_ADMIN_STORAGE_KEY, '1');
    } catch (_) {}
    setCurrentUser(FAKE_ADMIN_USER);
    setUserRole('admin');
  }, []);

  const logout = useCallback(async () => {
    try {
      sessionStorage.removeItem(CODE_ADMIN_STORAGE_KEY);
    } catch (_) {}
    try {
      await firebaseSignOut(auth);
    } catch (_) {}
    setCurrentUser(null);
    setUserRole(null);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const role = await resolveUserRole(user.uid);
        setUserRole(role);
      } else {
        // No Firebase user: check for code-based admin
        try {
          if (sessionStorage.getItem(CODE_ADMIN_STORAGE_KEY)) {
            setCurrentUser(FAKE_ADMIN_USER);
            setUserRole('admin');
          } else {
            setCurrentUser(null);
            setUserRole(null);
          }
        } catch (_) {
          setCurrentUser(null);
          setUserRole(null);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, loading, logout, setCodeAdminUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
