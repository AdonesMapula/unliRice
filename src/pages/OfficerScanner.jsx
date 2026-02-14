// src/pages/OfficerScanner.jsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import ScanResultCard from '../components/officer/ScanResultCard';

export default function OfficerScanner() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [plateNumber, setPlateNumber] = useState('');
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [officer, setOfficer] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [checkpointAddress, setCheckpointAddress] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchOfficer = async () => {
      if (!currentUser) return;
      try {
        const officerRef = doc(db, 'officers', currentUser.uid);
        const snap = await getDoc(officerRef);
        if (snap.exists()) {
          setOfficer(snap.data());
        }
      } catch (err) {
        console.error('Failed to load officer profile', err);
      }
    };

    fetchOfficer();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const storageRef = ref(storage, `officers/${currentUser.uid}/profile.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const officerRef = doc(db, 'officers', currentUser.uid);
      await updateDoc(officerRef, { photoURL: url });

      setOfficer((prev) => (prev ? { ...prev, photoURL: url } : prev));
    } catch (err) {
      console.error(err);
      setPhotoError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const startScanning = () => {
    setScanning(true);
    setError('');
    const codeReader = new BrowserMultiFormatReader();

    codeReader
      .decodeFromVideoDevice(undefined, 'video', (res, err) => {
        if (res) {
          try {
            const data = JSON.parse(res.getText());
            verifyDriverAndVehicle(data.uid, plateNumber.replace(/\s/g, '').toUpperCase());
            setScanning(false);
            codeReader.reset();
          } catch (e) {
            setError('Invalid QR format');
          }
        }
        if (err && !(err instanceof NotFoundException)) {
          console.error(err);
        }
      })
      .catch(() => {
        setError('Camera access denied or no QR found');
        setScanning(false);
      });
  };

  const verifyDriverAndVehicle = async (driverUid, plate) => {
    try {
      // 1. Driver
      const driverSnap = await getDoc(doc(db, 'drivers', driverUid));
      if (!driverSnap.exists()) throw new Error('Driver not found');
      const driver = driverSnap.data();

      // 2. Vehicle
      const vehicleSnap = await getDoc(doc(db, 'vehicles', plate));
      let vehicle = null;
      let authType = 'UNAUTHORIZED';

      if (vehicleSnap.exists()) {
        vehicle = vehicleSnap.data();

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
          // Borrowed authorization (example document id pattern: plate_driveruid)
          const authSnap = await getDoc(doc(db, 'authorizations', `${plate}_${driverUid}`));
          if (authSnap.exists() && authSnap.data().status === 'ACTIVE') {
            authType = 'BORROWED';
          }

          // Rented (simplified)
          const rentalSnap = await getDoc(doc(db, 'rentals', `${plate}_${driverUid}`));
          if (rentalSnap.exists()) {
            const rental = rentalSnap.data();
            if (new Date(rental.rentalEnd) > new Date()) {
              authType = 'RENTED';
            }
          }
        }
      }

      let overallStatus = 'UNAUTHORIZED';
      if (driver.licenseStatus !== 'valid') {
        overallStatus = 'EXPIRED';
      } else if (authType !== 'UNAUTHORIZED') {
        overallStatus = 'VALID';
      }

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
  };

  const handleMarkStolen = async () => {
    if (!result) return;
    try {
      const vehicleRef = doc(db, 'vehicles', result.plate);
      await updateDoc(vehicleRef, { status: 'STOLEN' });
      setResult((prev) => (prev ? { ...prev, overallStatus: 'STOLEN' } : prev));
    } catch (err) {
      setError('Failed to mark vehicle as stolen.');
    }
  };

  const handleClearStolen = async () => {
    if (!result) return;
    try {
      const vehicleRef = doc(db, 'vehicles', result.plate);
      await updateDoc(vehicleRef, { status: 'ACTIVE' });
      setResult((prev) =>
        prev ? { ...prev, overallStatus: prev.licenseStatus === 'valid' ? 'VALID' : 'EXPIRED' } : prev,
      );
    } catch (err) {
      setError('Failed to clear stolen status.');
    }
  };

  const handleLogStop = async () => {
    if (!result || !currentUser) return;
    try {
      const stopId = `${Date.now()}_${currentUser.uid}_${result.plate}`;
      const stopRef = doc(db, 'trafficStops', stopId);
      await setDoc(stopRef, {
        officerId: currentUser.uid,
        officerName: officer?.fullName || null,
        driverUid: result.driverUid,
        driverName: result.driverName,
        plateNumber: result.plate,
        overallStatus: result.overallStatus,
        authType: result.authType,
        checkpointAddress: checkpointAddress.trim() || null,
        createdAt: serverTimestamp(),
      });

      // If vehicle is borrowed or rented, notify the vehicle owner (for email in production use Cloud Function)
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
    } catch (err) {
      setError('Failed to log traffic stop.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                Officer Verification Scanner
              </h1>
              <p className="mt-2 text-slate-300 text-sm md:text-base">
                Enter the vehicle plate number, then scan the driver&apos;s QR code to verify on the LTMS registry.
              </p>
            </div>
            <button
                type="button"
                onClick={handleLogout}
                className="whitespace-nowrap flex-shrink-0 px-3 py-2 md:px-4 md:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs md:text-sm font-semibold text-slate-50 border border-slate-600 shadow-sm transition-colors"
                >
                Log out
            </button>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/70 border border-slate-700 rounded-2xl p-4">
            <div className="relative">
              {officer?.photoURL ? (
                <img
                  src={officer.photoURL}
                  alt={officer.fullName}
                  className="h-14 w-14 rounded-full object-cover border-2 border-emerald-400 shadow-md shadow-black/40"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-lg font-semibold text-slate-100">
                  {(officer?.fullName || 'OF')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold text-white shadow"
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? '...' : 'Edit'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div className="text-xs md:text-sm text-slate-200">
              <p className="font-semibold">
                {officer?.fullName || 'Officer on duty'}
              </p>
              <p className="text-slate-300">
                {officer?.role || 'Traffic Officer'} • {officer?.badgeNumber || 'Badge N/A'}
              </p>
              <p className="text-slate-400 text-[11px] md:text-xs">
                {officer?.station || 'Checkpoint'}
              </p>
            </div>
          </div>
          {photoError && (
            <p className="text-xs text-red-300">{photoError}</p>
          )}
        </header>

        <main className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)] items-start">
          {/* Controls */}
          <section className="bg-slate-900/70 border border-slate-700 rounded-2xl p-6 shadow-xl shadow-black/40">
            {!scanning ? (
              <div className="space-y-6">
                <div>
                  <label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-slate-300">
                    Vehicle Plate Number
                  </label>
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="NCA 1234"
                    className="w-full p-3.5 bg-slate-950/70 border border-slate-600 rounded-xl focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40 text-slate-50 placeholder:text-slate-500 outline-none transition-all font-mono tracking-wide"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Plate number is automatically uppercased.
                  </p>
                </div>

                <button
                  onClick={startScanning}
                  disabled={!plateNumber.trim()}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-900/60 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  Start QR Scan
                </button>

                {error && (
                  <p className="text-sm text-red-300 bg-red-900/60 border border-red-500/50 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <div className="text-xs text-slate-400 border-t border-slate-700 pt-4">
                  <p className="font-semibold uppercase tracking-wide text-slate-300 mb-1">
                    Instruction
                  </p>
                  <p>
                    Position the QR code within the camera frame. Ensure the plate number is correct before scanning
                    to avoid mismatched records.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <video
                    id="video"
                    className="w-full max-w-md mx-auto rounded-2xl border-4 border-emerald-500/60 shadow-lg shadow-black/70"
                    autoPlay
                    playsInline
                  />
                  <div className="absolute inset-6 border-2 border-emerald-400/80 rounded-2xl pointer-events-none" />
                </div>
                <button
                  onClick={() => setScanning(false)}
                  className="w-full bg-red-600 hover:bg-red-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors"
                >
                  Cancel Scan
                </button>
                <p className="text-xs text-slate-400 text-center">
                  If the camera does not activate, check browser permissions for camera access.
                </p>
              </div>
            )}
          </section>

          {/* Result + actions */}
          <section>
            {result ? (
              <>
                <ScanResultCard
                  result={result}
                  onClose={() => {
                    setResult(null);
                    setPlateNumber('');
                    setCheckpointAddress('');
                    setError('');
                  }}
                />
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      Checkpoint address (notifies vehicle owner if borrowed/rented)
                    </label>
                    <input
                      type="text"
                      value={checkpointAddress}
                      onChange={(e) => setCheckpointAddress(e.target.value)}
                      placeholder="e.g. Cebu City Checkpoint A, N. Bacaldo Ave."
                      className="w-full px-3 py-2 bg-slate-950/70 border border-slate-600 rounded-xl text-slate-50 placeholder:text-slate-500 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleMarkStolen}
                      className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-xs md:text-sm font-semibold text-white"
                    >
                      Mark vehicle as STOLEN
                    </button>
                    <button
                      type="button"
                      onClick={handleClearStolen}
                      className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs md:text-sm font-semibold text-white"
                    >
                      Clear stolen flag
                    </button>
                    <button
                      type="button"
                      onClick={handleLogStop}
                      className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs md:text-sm font-semibold text-white"
                    >
                      Log traffic stop
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-900/40 border border-dashed border-slate-600 rounded-2xl p-6 text-center text-slate-300 text-sm">
                <p className="font-medium">
                  Scan a driver&apos;s QR code to see license, vehicle, and authorization status here.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}