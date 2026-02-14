// src/pages/DriverDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { changePassword } from '../firebase/auth';
import DriverQRCard from '../components/driver/DriverQRCard';
import { User, Lock } from 'lucide-react';

export default function DriverDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [driver, setDriver] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    if (!currentUser) return;

    const fetchDriver = async () => {
      try {
        const snap = await getDoc(doc(db, 'drivers', currentUser.uid));
        if (snap.exists()) {
          setDriver(snap.data());
        }
      } catch (err) {
        console.error('Error fetching driver:', err);
      }
    };
    fetchDriver();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchVehicles = async () => {
      try {
        const ownedQuery = query(
          collection(db, 'vehicles'),
          where('ownerId', '==', currentUser.uid)
        );
        const ownedSnap = await getDocs(ownedQuery);
        const vehicleList = ownedSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        setVehicles(vehicleList);
      } catch (err) {
        console.error('Error fetching vehicles:', err);
      } finally {
        setLoadingVehicles(false);
      }
    };

    fetchVehicles();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage('');
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage('Password updated. Use your new password next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordMessage(err.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Driver Dashboard
            </h1>
            <p className="mt-2 text-slate-300 text-sm md:text-base">
              Access your digital QR identity and keep track of all registered vehicles.
            </p>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            {currentUser?.email && (
              <div className="text-right text-xs md:text-sm text-slate-400">
                <p className="uppercase tracking-wide text-slate-500 font-semibold">
                  Signed in as
                </p>
                <p className="font-mono truncate max-w-[10rem] md:max-w-xs">
                  {currentUser.email}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 md:px-4 md:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs md:text-sm font-semibold text-slate-50 border border-slate-600 shadow-sm"
            >
              Log out
            </button>
          </div>
        </header>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* QR Card */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-slate-100 flex items-center gap-2">
              <span className="h-6 w-1 rounded-full bg-blue-500" />
              Your QR Identity
            </h2>
            <DriverQRCard />
          </section>

          {/* Vehicles list */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-slate-100 flex items-center gap-2">
              <span className="h-6 w-1 rounded-full bg-emerald-500" />
              Your Vehicles
            </h2>

            {loadingVehicles ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-blue-500" />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="bg-slate-900/60 border border-dashed border-slate-600 rounded-xl p-6 text-center">
                <p className="text-slate-200 font-medium">
                  No vehicles registered yet.
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  Once a vehicle is linked to your license, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {vehicles.map((vehicle) => (
                  <article
                    key={vehicle.id}
                    className="bg-slate-900/70 border border-slate-700 rounded-xl p-5 shadow-lg shadow-black/40 hover:border-blue-500/70 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="font-semibold text-lg tracking-wide">
                          {vehicle.plateNumber}
                        </h3>
                        <p className="text-slate-300 text-sm">
                          {vehicle.vehicleType || 'Vehicle type not specified'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                          vehicle.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
                            : vehicle.status === 'STOLEN'
                            ? 'bg-red-600/20 text-red-200 border border-red-500/60'
                            : 'bg-slate-700/60 text-slate-100 border border-slate-500/70'
                        }`}
                      >
                        {vehicle.status}
                      </span>
                    </div>

                    <div className="mt-3 text-xs md:text-sm text-slate-300 space-y-1.5">
                      <p>
                        <span className="text-slate-400">Ownership:&nbsp;</span>
                        <span className="font-semibold">
                          OWNED
                        </span>
                      </p>
                      {(vehicle.brand || vehicle.series) && (
                        <p>
                          <span className="text-slate-400">Vehicle:&nbsp;</span>
                          <span className="font-medium">{[vehicle.brand, vehicle.series].filter(Boolean).join(' ')}</span>
                        </p>
                      )}
                      {vehicle.vehicleCategory && (
                        <p>
                          <span className="text-slate-400">Category:&nbsp;</span>
                          <span className="font-medium">{vehicle.vehicleCategory}</span>
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Account details - name cannot be changed; only password */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-3 text-slate-100 flex items-center gap-2">
            <span className="h-6 w-1 rounded-full bg-violet-500" />
            <User size={18} />
            Account details
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Your name and license details are set by the administrator. You can only change your password below.
          </p>
          {driver && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-4">
                <h3 className="font-medium text-slate-200">Profile (read-only)</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Full name</label>
                  <p className="px-3 py-2 bg-slate-800/60 border border-slate-600 rounded-lg text-slate-300">
                    {driver.fullName}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">License number</label>
                  <p className="px-3 py-2 bg-slate-800/60 border border-slate-600 rounded-lg text-slate-300 font-mono text-sm">
                    {driver.licenseNumber}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">License expiry</label>
                  <p className="px-3 py-2 bg-slate-800/60 border border-slate-600 rounded-lg text-slate-300">
                    {driver.licenseExpiry}
                  </p>
                </div>
              </div>
              <form onSubmit={handleChangePassword} className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-4">
                <h3 className="font-medium text-slate-200 flex items-center gap-2">
                  <Lock size={18} />
                  Change password
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Current password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded-lg text-slate-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded-lg text-slate-50"
                    required
                    minLength={6}
                  />
                </div>
                {passwordMessage && (
                  <p className={`text-sm ${passwordMessage.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {passwordMessage}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm disabled:opacity-60"
                >
                  {passwordSaving ? 'Updating…' : 'Change password'}
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Quick info / tips */}
        <section className="mt-10">
          <div className="bg-blue-500/10 border border-blue-500/40 rounded-2xl p-5 md:p-6">
            <h3 className="font-semibold text-blue-100 mb-1 text-sm uppercase tracking-wide">
              Using your Digital QR
            </h3>
            <p className="text-slate-100 text-sm md:text-base leading-relaxed">
              Present your QR code at checkpoints together with your vehicle plate number.
              Officers can instantly verify your license status and vehicle authorization
              from the LTMS system. Always keep your license updated to avoid violations.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}