import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import LoginScreen from './screens/LoginScreen';
import ScannerScreen from './screens/ScannerScreen';

export default function App() {
  const [user, setUser] = useState(null);
  const [isOfficer, setIsOfficer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'officers', firebaseUser.uid));
          setIsOfficer(snap.exists());
        } catch {
          setIsOfficer(false);
        }
      } else {
        setIsOfficer(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (user && isOfficer) {
    return <ScannerScreen />;
  }

  return <LoginScreen />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
});
