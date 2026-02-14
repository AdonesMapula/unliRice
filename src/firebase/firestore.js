// src/firebase/firestore.js
import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

// Get single document
export const getDriver = async (uid) => {
  const driverRef = doc(db, 'drivers', uid);
  const snap = await getDoc(driverRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getVehicle = async (plateNumber) => {
  const vehicleRef = doc(db, 'vehicles', plateNumber.toUpperCase());
  const snap = await getDoc(vehicleRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Log a scan (important for audit trail)
export const logScan = async (officerId, driverId, plateNumber, result) => {
  try {
    await addDoc(collection(db, 'scanLogs'), {
      officerId,
      driverId,
      plateNumber: plateNumber.toUpperCase(),
      result,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    });
    console.log('Scan logged successfully');
  } catch (error) {
    console.error('Failed to log scan:', error);
  }
};

// Example: Get driver's vehicles (owned only for simplicity)
export const getDriverVehicles = async (driverUid) => {
  const q = query(
    collection(db, 'vehicles'),
    where('ownerId', '==', driverUid)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Update driver last seen / last login (optional)
export const updateDriverLastLogin = async (uid) => {
  const driverRef = doc(db, 'drivers', uid);
  await updateDoc(driverRef, {
    lastLogin: serverTimestamp(),
  });
};

// Admin: get collection counts for dashboard
export const getCollectionCount = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.size;
};

export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
};