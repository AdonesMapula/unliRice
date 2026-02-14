import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function ScannerScreen() {
  const [plateNumber, setPlateNumber] = useState('');
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [officer, setOfficer] = useState(null);
  const [checkpointAddress, setCheckpointAddress] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!auth.currentUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'officers', auth.currentUser.uid));
        if (snap.exists()) setOfficer(snap.data());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const verifyDriverAndVehicle = useCallback(async (driverUid, plate) => {
    try {
      setError('');
      const driverSnap = await getDoc(doc(db, 'drivers', driverUid));
      if (!driverSnap.exists()) throw new Error('Driver not found');
      const driver = driverSnap.data();

      const vehicleSnap = await getDoc(doc(db, 'vehicles', plate));
      let authType = 'UNAUTHORIZED';

      if (vehicleSnap.exists()) {
        const vehicle = vehicleSnap.data();
        if (vehicle.status === 'STOLEN') {
          setResult({
            driverUid,
            driverName: driver.fullName,
            licenseStatus: driver.licenseStatus,
            plate,
            authType: 'UNAUTHORIZED',
            overallStatus: 'STOLEN',
          });
          return;
        }
        if (vehicle.ownerId === driverUid) {
          authType = 'OWNED';
        } else {
          const authSnap = await getDoc(doc(db, 'authorizations', `${plate}_${driverUid}`));
          if (authSnap.exists() && authSnap.data().status === 'ACTIVE') authType = 'BORROWED';
          const rentalSnap = await getDoc(doc(db, 'rentals', `${plate}_${driverUid}`));
          if (rentalSnap.exists()) {
            const rental = rentalSnap.data();
            if (new Date(rental.rentalEnd) > new Date()) authType = 'RENTED';
          }
        }
      }

      let overallStatus = 'UNAUTHORIZED';
      if (driver.licenseStatus !== 'valid') overallStatus = 'EXPIRED';
      else if (authType !== 'UNAUTHORIZED') overallStatus = 'VALID';

      setResult({
        driverUid,
        driverName: driver.fullName,
        licenseStatus: driver.licenseStatus,
        plate,
        authType,
        overallStatus,
      });
    } catch (err) {
      setError(err.message || 'Verification failed');
    }
  }, []);

  const onBarcodeScanned = useCallback(
    ({ data }) => {
      if (!scanning || !plateNumber.trim()) return;
      try {
        const parsed = JSON.parse(data);
        const uid = parsed.uid;
        if (uid) {
          setScanning(false);
          verifyDriverAndVehicle(uid, plateNumber.replace(/\s/g, '').toUpperCase());
        }
      } catch {
        setError('Invalid QR format');
      }
    },
    [scanning, plateNumber, verifyDriverAndVehicle]
  );

  const startScanning = () => {
    if (!plateNumber.trim()) {
      Alert.alert('Enter plate', 'Enter vehicle plate number first.');
      return;
    }
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    setResult(null);
    setError('');
    setScanning(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkStolen = async () => {
    if (!result) return;
    try {
      await updateDoc(doc(db, 'vehicles', result.plate), { status: 'STOLEN' });
      setResult((prev) => (prev ? { ...prev, overallStatus: 'STOLEN' } : prev));
    } catch (e) {
      Alert.alert('Error', 'Failed to mark as stolen.');
    }
  };

  const handleClearStolen = async () => {
    if (!result) return;
    try {
      await updateDoc(doc(db, 'vehicles', result.plate), { status: 'ACTIVE' });
      setResult((prev) =>
        prev ? { ...prev, overallStatus: prev.licenseStatus === 'valid' ? 'VALID' : 'EXPIRED' } : prev
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to clear stolen status.');
    }
  };

  const handleLogStop = async () => {
    if (!result || !auth.currentUser) return;
    try {
      const stopId = `${Date.now()}_${auth.currentUser.uid}_${result.plate}`;
      await setDoc(doc(db, 'trafficStops', stopId), {
        officerId: auth.currentUser.uid,
        officerName: officer?.fullName || null,
        driverUid: result.driverUid,
        driverName: result.driverName,
        plateNumber: result.plate,
        overallStatus: result.overallStatus,
        authType: result.authType,
        checkpointAddress: checkpointAddress.trim() || null,
        createdAt: serverTimestamp(),
      });
      if (result.authType === 'BORROWED' || result.authType === 'RENTED') {
        const vehicleSnap = await getDoc(doc(db, 'vehicles', result.plate));
        if (vehicleSnap.exists()) {
          const vehicle = vehicleSnap.data();
          const ownerId = vehicle.ownerId;
          if (ownerId) {
            const ownerSnap = await getDoc(doc(db, 'vehicleOwners', ownerId));
            const ownerEmail = ownerSnap.exists() ? ownerSnap.data().email : null;
            await setDoc(doc(db, 'checkpointNotifications', stopId), {
              ownerId,
              ownerEmail: ownerEmail || null,
              vehiclePlate: result.plate,
              checkpointAddress: checkpointAddress.trim() || null,
              driverName: result.driverName,
              driverUid: result.driverUid,
              createdAt: serverTimestamp(),
            });
          }
        }
      }
      Alert.alert('Logged', 'Traffic stop recorded.');
    } catch (e) {
      Alert.alert('Error', 'Failed to log traffic stop.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'VALID': return '#22c55e';
      case 'EXPIRED': return '#f59e0b';
      case 'STOLEN': return '#dc2626';
      default: return '#ef4444';
    }
  };

  if (scanning) {
    return (
      <View style={styles.scanContainer}>
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={onBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />
        </View>
        <View style={styles.overlay}>
          <Text style={styles.scanHint}>Align QR code within frame</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelBtnText}>Cancel Scan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Officer Scanner</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Vehicle plate number</Text>
      <TextInput
        style={styles.input}
value={plateNumber}
                  onChangeText={(t) => setPlateNumber(t.toUpperCase().replace(/\s/g, ''))}
        placeholder="e.g. NCA 1234"
        placeholderTextColor="#64748b"
        autoCapitalize="characters"
      />

      <TouchableOpacity style={styles.scanButton} onPress={startScanning}>
        <Text style={styles.scanButtonText}>Start QR Scan</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {result ? (
        <View style={[styles.resultCard, { borderColor: getStatusColor(result.overallStatus) }]}>
          <Text style={[styles.resultStatus, { color: getStatusColor(result.overallStatus) }]}>
            {result.overallStatus}
          </Text>
          <Text style={styles.resultLabel}>Driver</Text>
          <Text style={styles.resultValue}>{result.driverName}</Text>
          <Text style={styles.resultLabel}>License</Text>
          <Text style={styles.resultValue}>{result.licenseStatus}</Text>
          <Text style={styles.resultLabel}>Plate</Text>
          <Text style={styles.resultValue}>{result.plate}</Text>
          <Text style={styles.resultLabel}>Authorization</Text>
          <Text style={styles.resultValue}>{result.authType}</Text>

          <Text style={styles.label}>Checkpoint address (notifies owner if borrowed/rented)</Text>
          <TextInput
            style={styles.input}
            value={checkpointAddress}
            onChangeText={setCheckpointAddress}
            placeholder="e.g. Cebu City Checkpoint A"
            placeholderTextColor="#64748b"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtnRed, styles.actionBtn]} onPress={handleMarkStolen}>
              <Text style={styles.actionBtnText}>Mark STOLEN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnGreen, styles.actionBtn]} onPress={handleClearStolen}>
              <Text style={styles.actionBtnText}>Clear stolen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnGray, styles.actionBtn]} onPress={handleLogStop}>
              <Text style={styles.actionBtnText}>Log traffic stop</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.clearResult}
            onPress={() => { setResult(null); setCheckpointAddress(''); setError(''); }}
          >
            <Text style={styles.clearResultText}>Scan another</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.placeholder}>Scan a driver QR to see result here.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scanContainer: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  logoutBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  logoutText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    padding: 14,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorText: { color: '#f87171', marginBottom: 12, fontSize: 14 },
  resultCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  resultStatus: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  resultLabel: { fontSize: 11, color: '#64748b', marginTop: 8 },
  resultValue: { fontSize: 16, color: '#f8fafc', fontWeight: '600' },
  actions: { marginTop: 16 },
  actionBtn: { marginTop: 10 },
  actionBtnRed: { backgroundColor: '#b91c1c', borderRadius: 10, padding: 12 },
  actionBtnGreen: { backgroundColor: '#047857', borderRadius: 10, padding: 12 },
  actionBtnGray: { backgroundColor: '#475569', borderRadius: 10, padding: 12 },
  actionBtnText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  clearResult: { marginTop: 12, padding: 12 },
  clearResultText: { color: '#94a3b8', textAlign: 'center', fontWeight: '600' },
  placeholder: { color: '#64748b', textAlign: 'center', marginTop: 24 },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    alignItems: 'center',
  },
  scanHint: { color: '#fff', marginBottom: 16, fontSize: 16 },
  cancelBtn: { backgroundColor: '#dc2626', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  cancelBtnText: { color: '#fff', fontWeight: '700' },
});
