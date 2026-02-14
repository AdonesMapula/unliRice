// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext({
  currentUser: null,
  userRole: null,
  loading: true,
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const role = await resolveUserRole(user.uid);
        setUserRole(role);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);