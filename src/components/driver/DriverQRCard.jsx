// src/components/driver/DriverQRCard.jsx
import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../../firebase/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function DriverQRCard() {
  const { currentUser } = useAuth();
  const [driver, setDriver] = useState(null);
  const [qrValue, setQrValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;

    const fetchDriver = async () => {
      const driverRef = doc(db, 'drivers', currentUser.uid);
      const snap = await getDoc(driverRef);
      if (snap.exists()) {
        setDriver(snap.data());

        const payload = {
          uid: currentUser.uid,
          ts: Date.now(),
        };
        setQrValue(JSON.stringify(payload));
      }
    };

    fetchDriver();

    // Refresh QR every 5 minutes
    const interval = setInterval(() => {
      setQrValue(
        JSON.stringify({
          uid: currentUser.uid,
          ts: Date.now(),
        }),
      );
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    setUploading(true);
    setUploadError('');
    try {
      const storageRef = ref(storage, `drivers/${currentUser.uid}/profile.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const driverRef = doc(db, 'drivers', currentUser.uid);
      await updateDoc(driverRef, { photoURL: url });

      setDriver((prev) => (prev ? { ...prev, photoURL: url } : prev));
    } catch (err) {
      console.error(err);
      setUploadError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!driver || !qrValue) {
    return (
      <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 max-w-sm mx-auto flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-blue-500" />
        <p className="text-slate-200 text-sm text-center">
          Preparing your secure QR identity…
        </p>
      </div>
    );
  }

  const initials =
    driver.fullName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'DR';

  return (
    <div className="bg-slate-900/70 rounded-2xl shadow-xl shadow-black/50 p-6 max-w-sm mx-auto border border-slate-700">
      <div className="flex flex-col items-center mb-4">
        <div className="relative">
          {driver.photoURL ? (
            <img
              src={driver.photoURL}
              alt={driver.fullName}
              className="h-20 w-20 rounded-full object-cover border-2 border-emerald-400 shadow-md shadow-black/40"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-2xl font-semibold text-slate-100">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 px-2 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold text-white shadow"
            disabled={uploading}
          >
            {uploading ? '...' : 'Edit'}
          </button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handlePhotoChange}
          />
        </div>
        <div className="mt-3 text-center">
          <h2 className="text-xl font-semibold text-slate-50">
            {driver.fullName}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            License No.&nbsp;
            <span className="font-mono font-semibold">
              {driver.licenseNumber}
            </span>
          </p>
        </div>
      </div>

      <div className="flex justify-center mb-6">
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-700 shadow-inner">
          <QRCodeCanvas value={qrValue} size={220} level="H" />
        </div>
      </div>

      <div className="text-center space-y-1">
        <p
          className={`text-sm font-semibold tracking-wide uppercase ${
            driver.licenseStatus === 'valid'
              ? 'text-emerald-300'
              : driver.licenseStatus === 'expired'
              ? 'text-amber-300'
              : 'text-red-300'
          }`}
        >
          License Status: {driver.licenseStatus?.toUpperCase()}
        </p>
        <p className="text-xs text-slate-400">
          Expiry:&nbsp;
          <span className="font-medium">{driver.licenseExpiry}</span>
        </p>
      </div>

      {uploadError && (
        <p className="mt-3 text-[11px] text-red-300 text-center">
          {uploadError}
        </p>
      )}
    </div>
  );
}