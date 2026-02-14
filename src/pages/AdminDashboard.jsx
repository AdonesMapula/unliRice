import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut as firebaseSignOut, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Car,
  CarFront,
  Shield,
  LogOut,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

function computeLicenseStatus(expiry) {
  if (!expiry) return 'expired';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry);
  exp.setHours(0, 0, 0, 0);
  return exp >= today ? 'valid' : 'expired';
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'officer', label: 'Create Officer', icon: Shield },
  { id: 'user', label: 'Register User (Driver)', icon: Users },
  { id: 'owner', label: 'Register Vehicle Owner', icon: Car },
  { id: 'vehicle', label: 'Register Vehicle', icon: CarFront },
];

export default function AdminDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [counts, setCounts] = useState({
    drivers: 0,
    officers: 0,
    vehicleOwners: 0,
    vehicles: 0,
    scanLogs: 0,
    trafficStops: 0,
  });
  const [recentStops, setRecentStops] = useState([]);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [error, setError] = useState('');

  // Create Officer form
  const [officerFullName, setOfficerFullName] = useState('');
  const [officerEmail, setOfficerEmail] = useState('');
  const [officerPassword, setOfficerPassword] = useState('');
  const [officerBadge, setOfficerBadge] = useState('');
  const [officerStation, setOfficerStation] = useState('');
  const [officerSubmitting, setOfficerSubmitting] = useState(false);

  // Register User (Driver) form
  const [driverFullName, setDriverFullName] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverExpiry, setDriverExpiry] = useState('');
  const [driverSubmitting, setDriverSubmitting] = useState(false);

  // Register Owner form
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerCompany, setOwnerCompany] = useState('');
  const [ownerSubmitting, setOwnerSubmitting] = useState(false);

  // Register Vehicle form – owner can be driver or vehicle owner
  const [ownerOptions, setOwnerOptions] = useState([]); // { id, name, type: 'driver'|'owner' }
  const [vehiclePlateNo, setVehiclePlateNo] = useState('');
  const [vehicleChasisNo, setVehicleChasisNo] = useState('');
  const [vehicleFileNo, setVehicleFileNo] = useState('');
  const [vehicleType, setVehicleType] = useState('Sedan');
  const [vehicleCategory, setVehicleCategory] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleOwnerId, setVehicleOwnerId] = useState('');
  const [vehicleOwnerName, setVehicleOwnerName] = useState('');
  const [vehicleSeries, setVehicleSeries] = useState('');
  const [vehicleYearModel, setVehicleYearModel] = useState('');
  const [vehicleCrNo, setVehicleCrNo] = useState('');
  const [vehicleOrNo, setVehicleOrNo] = useState('');
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);

  useEffect(() => {
    if (successMessage && location.state?.message) {
      window.history.replaceState({}, '', '/admin');
    }
  }, [successMessage, location.state]);

  useEffect(() => {
    const fetchCounts = async () => {
      setLoadingCounts(true);
      setFetchError('');
      try {
        const [drivers, officers, vehicleOwners, vehicles, scanLogs, trafficStops] = await Promise.all([
          getDocs(collection(db, 'drivers')).then((s) => s.size),
          getDocs(collection(db, 'officers')).then((s) => s.size),
          getDocs(collection(db, 'vehicleOwners')).then((s) => s.size),
          getDocs(collection(db, 'vehicles')).then((s) => s.size),
          getDocs(collection(db, 'scanLogs')).then((s) => s.size),
          getDocs(collection(db, 'trafficStops')).then((s) => s.size),
        ]);
        setCounts({ drivers, officers, vehicleOwners, vehicles, scanLogs, trafficStops });
      } catch (err) {
        console.error('Admin fetch counts failed:', err);
        setFetchError(err.message || 'Failed to load dashboard data. Check Firebase project and Firestore rules.');
      } finally {
        setLoadingCounts(false);
      }
    };
    fetchCounts();
  }, []);

  useEffect(() => {
    const fetchRecentStops = async () => {
      try {
        const q = query(
          collection(db, 'trafficStops'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const snap = await getDocs(q);
        setRecentStops(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        try {
          const snap = await getDocs(collection(db, 'trafficStops'));
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          docs.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const tb = b.createdAt?.toMillis?.() ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return (tb || 0) - (ta || 0);
          });
          setRecentStops(docs.slice(0, 5));
        } catch (e) {
          console.error('Fetch recent stops failed:', e);
        }
      }
    };
    fetchRecentStops();
  }, []);

  useEffect(() => {
    if (activeTab !== 'vehicle') return;
    const fetchOwners = async () => {
      try {
        const [driversSnap, ownersSnap] = await Promise.all([
          getDocs(collection(db, 'drivers')),
          getDocs(collection(db, 'vehicleOwners')),
        ]);
        const drivers = driversSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.fullName || data.email || d.id,
            type: 'driver',
          };
        });
        const owners = ownersSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.fullName || data.companyName || data.email || d.id,
            type: 'owner',
          };
        });
        setOwnerOptions([...drivers, ...owners]);
      } catch (err) {
        console.error('Fetch owners failed:', err);
        setError(err.message || 'Failed to load drivers/owners for vehicle registration.');
      }
    };
    fetchOwners();
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const createOfficer = async (e) => {
    e.preventDefault();
    setError('');
    setOfficerSubmitting(true);
    try {
      const email = officerEmail.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(auth, email, officerPassword);
      await setDoc(doc(db, 'officers', cred.user.uid), {
        id: cred.user.uid,
        fullName: officerFullName.trim(),
        badgeNumber: officerBadge.trim(),
        role: 'Traffic Officer',
        station: officerStation.trim(),
        createdAt: serverTimestamp(),
      });
      await firebaseSignOut(auth);
      navigate('/login', { state: { message: 'Officer account created. Please sign in again as admin.' } });
    } catch (err) {
      setError(err.message || 'Failed to create officer.');
    } finally {
      setOfficerSubmitting(false);
    }
  };

  const createDriver = async (e) => {
    e.preventDefault();
    setError('');
    const last6 = driverLicense.replace(/\D/g, '').slice(-6);
    if (last6.length < 6) {
      setError('License number must have at least 6 digits for default password.');
      return;
    }
    setDriverSubmitting(true);
    try {
      const email = driverEmail.trim().toLowerCase();
      const defaultPassword = last6;
      const cred = await createUserWithEmailAndPassword(auth, email, defaultPassword);
      const status = computeLicenseStatus(driverExpiry);
      await setDoc(doc(db, 'drivers', cred.user.uid), {
        id: cred.user.uid,
        fullName: driverFullName.trim(),
        licenseNumber: driverLicense.trim().toUpperCase(),
        licenseExpiry: driverExpiry,
        licenseStatus: status,
        isFirstLogin: true,
        createdAt: serverTimestamp(),
      });
      await firebaseSignOut(auth);
      navigate('/login', {
        state: {
          message: `Driver "${driverFullName}" created. Default password: last 6 digits of license. Please sign in again as admin.`,
        },
      });
    } catch (err) {
      setError(err.message || 'Failed to register driver.');
    } finally {
      setDriverSubmitting(false);
    }
  };

  const createOwner = async (e) => {
    e.preventDefault();
    setError('');
    setOwnerSubmitting(true);
    try {
      const email = ownerEmail.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(auth, email, ownerPassword);
      await setDoc(doc(db, 'vehicleOwners', cred.user.uid), {
        id: cred.user.uid,
        fullName: ownerFullName.trim(),
        email: email,
        companyName: ownerCompany.trim() || null,
        createdAt: serverTimestamp(),
      });
      await firebaseSignOut(auth);
      navigate('/login', { state: { message: 'Vehicle owner account created. Please sign in again as admin.' } });
    } catch (err) {
      setError(err.message || 'Failed to register vehicle owner.');
    } finally {
      setOwnerSubmitting(false);
    }
  };

  const registerVehicle = async (e) => {
    e.preventDefault();
    setError('');
    const plate = vehiclePlateNo.replace(/\s/g, '').toUpperCase();
    if (!plate) {
      setError('Plate No. is required.');
      return;
    }
    if (!vehicleOwnerId) {
      setError('Please select an owner (driver or vehicle owner).');
      return;
    }
    setVehicleSubmitting(true);
    try {
      const vehicleRef = doc(db, 'vehicles', plate);
      const existing = await getDoc(vehicleRef);
      if (existing.exists()) {
        setError('A vehicle with this plate number is already registered.');
        setVehicleSubmitting(false);
        return;
      }
      const selected = ownerOptions.find((o) => o.id === vehicleOwnerId);
      await setDoc(vehicleRef, {
        plateNumber: plate,
        chasisNo: vehicleChasisNo.trim() || null,
        fileNo: vehicleFileNo.trim() || null,
        vehicleType: vehicleType.trim() || 'Sedan',
        vehicleCategory: vehicleCategory.trim() || null,
        brand: vehicleBrand.trim() || null,
        color: vehicleColor.trim() || null,
        ownerId: vehicleOwnerId,
        ownerName: selected?.name || vehicleOwnerName.trim() || null,
        ownerType: selected?.type || null,
        series: vehicleSeries.trim() || null,
        yearModel: vehicleYearModel.trim() || null,
        crNo: vehicleCrNo.trim() || null,
        orNo: vehicleOrNo.trim() || null,
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
      });
      setSuccessMessage(`Vehicle ${plate} registered and linked to owner.`);
      setVehiclePlateNo('');
      setVehicleChasisNo('');
      setVehicleFileNo('');
      setVehicleCategory('');
      setVehicleBrand('');
      setVehicleColor('');
      setVehicleOwnerId('');
      setVehicleOwnerName('');
      setVehicleSeries('');
      setVehicleYearModel('');
      setVehicleCrNo('');
      setVehicleOrNo('');
      setVehicleType('Sedan');
    } catch (err) {
      setError(err.message || 'Failed to register vehicle.');
    } finally {
      setVehicleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-slate-900/80 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="font-black text-lg tracking-tight">Admin</h1>
          <p className="text-slate-400 text-xs mt-1">LTMS Control Panel</p>
        </div>
        <nav className="p-2 flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setError(''); setSuccessMessage(''); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-700">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-slate-100 text-sm font-medium"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6 md:p-8">
        {successMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 px-4 py-3 text-sm">
            <CheckCircle2 size={20} />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 text-sm">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
            {fetchError && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 px-4 py-3 text-sm">
                <AlertCircle size={20} />
                {fetchError}
                <span className="text-amber-300/80 text-xs block mt-1">Ensure you are using the Firebase project that contains your data and that Firestore rules allow read.</span>
              </div>
            )}
            {loadingCounts ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-blue-500" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                  {[
                    { label: 'Drivers', value: counts.drivers, color: 'blue' },
                    { label: 'Officers', value: counts.officers, color: 'emerald' },
                    { label: 'Vehicle Owners', value: counts.vehicleOwners, color: 'amber' },
                    { label: 'Vehicles', value: counts.vehicles, color: 'violet' },
                    { label: 'Scan Logs', value: counts.scanLogs, color: 'slate' },
                    { label: 'Traffic Stops', value: counts.trafficStops, color: 'rose' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border bg-slate-900/60 border-slate-700 p-4 ${
                        item.color === 'blue' ? 'border-blue-500/40' : ''
                      } ${item.color === 'emerald' ? 'border-emerald-500/40' : ''} ${
                        item.color === 'amber' ? 'border-amber-500/40' : ''
                      } ${item.color === 'violet' ? 'border-violet-500/40' : ''} ${
                        item.color === 'rose' ? 'border-rose-500/40' : ''
                      }`}
                    >
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">{item.label}</p>
                      <p className="text-2xl font-black mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
                  <h3 className="font-semibold mb-4">Recent Traffic Stops</h3>
                  {recentStops.length === 0 ? (
                    <p className="text-slate-400 text-sm">No traffic stops recorded yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {recentStops.map((stop) => (
                        <li
                          key={stop.id}
                          className="flex flex-wrap items-center gap-2 text-sm py-2 border-b border-slate-700 last:border-0"
                        >
                          <span className="font-mono text-slate-300">{stop.plateNumber}</span>
                          <span className="text-slate-400">•</span>
                          <span>{stop.driverName}</span>
                          <span className="text-slate-400">•</span>
                          <span
                            className={`font-semibold uppercase ${
                              stop.overallStatus === 'VALID' ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {stop.overallStatus}
                          </span>
                          {stop.checkpointAddress && (
                            <>
                              <span className="text-slate-400">@</span>
                              <span className="text-slate-400">{stop.checkpointAddress}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'officer' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Create Officer Account</h2>
            <form onSubmit={createOfficer} className="max-w-md space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={officerFullName}
                  onChange={(e) => setOfficerFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Email (@ltms.gov.ph)
                </label>
                <input
                  type="email"
                  value={officerEmail}
                  onChange={(e) => setOfficerEmail(e.target.value)}
                  placeholder="officer@ltms.gov.ph"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={officerPassword}
                  onChange={(e) => setOfficerPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Badge Number
                </label>
                <input
                  type="text"
                  value={officerBadge}
                  onChange={(e) => setOfficerBadge(e.target.value)}
                  placeholder="LTMS-OPS-0423"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Station
                </label>
                <input
                  type="text"
                  value={officerStation}
                  onChange={(e) => setOfficerStation(e.target.value)}
                  placeholder="Cebu City Checkpoint A"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={officerSubmitting}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-60"
              >
                {officerSubmitting ? 'Creating…' : 'Create Officer'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'user' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Register User (Driver)</h2>
            <p className="text-slate-400 text-sm mb-4">
              Driver will get default password: last 6 digits of license number. They can change it on first login.
            </p>
            <form onSubmit={createDriver} className="max-w-md space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={driverFullName}
                  onChange={(e) => {
                    setDriverFullName(e.target.value);
                    if (!driverEmail) {
                      const base = e.target.value.replace(/\s+/g, '').toLowerCase();
                      if (base) setDriverEmail(`${base}@fake.ltms.com`);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Email (e.g. FirstnameLastname@fake.ltms.com)
                </label>
                <input
                  type="email"
                  value={driverEmail}
                  onChange={(e) => setDriverEmail(e.target.value)}
                  placeholder="juan.delacruz@fake.ltms.com"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  License Number
                </label>
                <input
                  type="text"
                  value={driverLicense}
                  onChange={(e) => setDriverLicense(e.target.value.toUpperCase())}
                  placeholder="D22-33-445566"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none font-mono"
                  required
                />
                <p className="text-slate-500 text-xs mt-1">Last 6 digits will be used as default password.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  License Expiry
                </label>
                <input
                  type="date"
                  value={driverExpiry}
                  onChange={(e) => setDriverExpiry(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={driverSubmitting}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-60"
              >
                {driverSubmitting ? 'Registering…' : 'Register Driver'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'owner' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Register Vehicle Rental Owner</h2>
            <form onSubmit={createOwner} className="max-w-md space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={ownerFullName}
                  onChange={(e) => setOwnerFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Company Name (optional)
                </label>
                <input
                  type="text"
                  value={ownerCompany}
                  onChange={(e) => setOwnerCompany(e.target.value)}
                  placeholder="e.g. Rent-A-Car Co."
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={ownerSubmitting}
                className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-60"
              >
                {ownerSubmitting ? 'Registering…' : 'Register Vehicle Owner'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'vehicle' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Register Vehicle</h2>
            <p className="text-slate-400 text-sm mb-6">
              Register a vehicle and link it to a driver or vehicle owner. The owner will see this vehicle in their dashboard.
            </p>
            <form onSubmit={registerVehicle} className="max-w-2xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Plate No.</label>
                  <input
                    type="text"
                    value={vehiclePlateNo}
                    onChange={(e) => setVehiclePlateNo(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC 1234"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Chasis No.</label>
                  <input
                    type="text"
                    value={vehicleChasisNo}
                    onChange={(e) => setVehicleChasisNo(e.target.value)}
                    placeholder="Chassis number"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">File No.</label>
                  <input
                    type="text"
                    value={vehicleFileNo}
                    onChange={(e) => setVehicleFileNo(e.target.value)}
                    placeholder="File number"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Vehicle Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  >
                    <option>Sedan</option>
                    <option>SUV</option>
                    <option>Van</option>
                    <option>Pickup</option>
                    <option>Motorcycle</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Vehicle Category</label>
                <input
                  type="text"
                  value={vehicleCategory}
                  onChange={(e) => setVehicleCategory(e.target.value)}
                  placeholder="e.g. Private, For Hire, Government"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Brand</label>
                  <input
                    type="text"
                    value={vehicleBrand}
                    onChange={(e) => setVehicleBrand(e.target.value)}
                    placeholder="e.g. Toyota, Honda"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Color</label>
                  <input
                    type="text"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    placeholder="e.g. White, Black"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Owner (Driver or Vehicle Owner)</label>
                <select
                  value={vehicleOwnerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setVehicleOwnerId(id);
                    const o = ownerOptions.find((x) => x.id === id);
                    setVehicleOwnerName(o ? o.name : '');
                  }}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  required
                >
                  <option value="">Select owner…</option>
                  {ownerOptions.map((o) => (
                    <option key={`${o.type}-${o.id}`} value={o.id}>
                      {o.type === 'driver' ? 'Driver' : 'Owner'}: {o.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-slate-500 text-xs">Owners name: {vehicleOwnerName || '—'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Series</label>
                  <input
                    type="text"
                    value={vehicleSeries}
                    onChange={(e) => setVehicleSeries(e.target.value)}
                    placeholder="e.g. Vios, Civic"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Year Model</label>
                  <input
                    type="text"
                    value={vehicleYearModel}
                    onChange={(e) => setVehicleYearModel(e.target.value)}
                    placeholder="e.g. 2023"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">CR No.</label>
                  <input
                    type="text"
                    value={vehicleCrNo}
                    onChange={(e) => setVehicleCrNo(e.target.value)}
                    placeholder="Certificate of Registration No."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">OR No.</label>
                  <input
                    type="text"
                    value={vehicleOrNo}
                    onChange={(e) => setVehicleOrNo(e.target.value)}
                    placeholder="Official Receipt No."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-slate-50 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={vehicleSubmitting}
                className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold disabled:opacity-60"
              >
                {vehicleSubmitting ? 'Registering…' : 'Register Vehicle'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
