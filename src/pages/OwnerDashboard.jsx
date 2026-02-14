import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Car,
  PlusCircle,
  UserCheck,
  Bell,
  LogOut,
  CheckCircle2,
  XCircle,
  MapPin,
} from 'lucide-react';

export default function OwnerDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  // Register car form
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState('Sedan');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  // Authorize driver
  const [showAuthorize, setShowAuthorize] = useState(false);
  const [selectedVehiclePlate, setSelectedVehiclePlate] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [driverResults, setDriverResults] = useState([]);
  const [authorizeSubmitting, setAuthorizeSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const fetchVehicles = async () => {
      setLoadingVehicles(true);
      try {
        const q = query(
          collection(db, 'vehicles'),
          where('ownerId', '==', currentUser.uid)
        );
        const snap = await getDocs(q);
        setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingVehicles(false);
      }
    };
    fetchVehicles();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchNotifications = async () => {
      setLoadingNotifications(true);
      try {
        const q = query(
          collection(db, 'checkpointNotifications'),
          where('ownerId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingNotifications(false);
      }
    };
    fetchNotifications();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setAddError('');
    const plate = plateNumber.replace(/\s/g, '').toUpperCase();
    if (!plate) return;
    setAddSubmitting(true);
    try {
      const vehicleRef = doc(db, 'vehicles', plate);
      const existing = await getDoc(vehicleRef);
      if (existing.exists()) {
        setAddError('This plate number is already registered.');
        setAddSubmitting(false);
        return;
      }
      await setDoc(vehicleRef, {
        plateNumber: plate,
        model: model.trim() || null,
        vehicleType: vehicleType.trim() || 'Sedan',
        ownerId: currentUser.uid,
        status: 'ACTIVE',
        rentalReady: false,
        availableForRental: true,
        createdAt: serverTimestamp(),
      });
      setVehicles((prev) => [
        ...prev,
        {
          id: plate,
          plateNumber: plate,
          model: model.trim() || null,
          vehicleType: vehicleType.trim() || 'Sedan',
          ownerId: currentUser.uid,
          status: 'ACTIVE',
          rentalReady: false,
          availableForRental: true,
        },
      ]);
      setPlateNumber('');
      setModel('');
      setShowAddVehicle(false);
    } catch (err) {
      setAddError(err.message || 'Failed to register vehicle.');
    } finally {
      setAddSubmitting(false);
    }
  };

  const toggleRentalReady = async (vehicle) => {
    try {
      const ref = doc(db, 'vehicles', vehicle.id);
      await updateDoc(ref, { rentalReady: !vehicle.rentalReady });
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id ? { ...v, rentalReady: !v.rentalReady } : v
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const searchDrivers = async () => {
    if (!driverSearch.trim()) return;
    try {
      const driversSnap = await getDocs(collection(db, 'drivers'));
      const term = driverSearch.trim().toLowerCase();
      const list = driversSnap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter(
          (d) =>
            d.fullName?.toLowerCase().includes(term) ||
            d.licenseNumber?.toLowerCase().includes(term)
        )
        .slice(0, 10);
      setDriverResults(list);
    } catch (err) {
      console.error(err);
    }
  };

  const addAuthorization = async (driverUid, driverName) => {
    if (!selectedVehiclePlate) return;
    setAuthorizeSubmitting(true);
    try {
      const plate = selectedVehiclePlate.replace(/\s/g, '').toUpperCase();
      const authId = `${plate}_${driverUid}`;
      await setDoc(doc(db, 'authorizations', authId), {
        plateNumber: plate,
        driverUid,
        driverName,
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
      });
      setShowAuthorize(false);
      setSelectedVehiclePlate('');
      setDriverSearch('');
      setDriverResults([]);
    } catch (err) {
      console.error(err);
    } finally {
      setAuthorizeSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Vehicle Rental Owner</h1>
            <p className="mt-2 text-slate-300 text-sm">
              Manage your vehicles for rental and authorize drivers.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm">{currentUser?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold border border-slate-600 flex items-center gap-2"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </header>

        {/* Notifications (checkpoint stops) */}
        <section className="mb-8 rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell size={20} className="text-amber-400" />
            Checkpoint Notifications
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            You will be notified here when a vehicle you own (or have lent) is stopped at a checkpoint. In production, these are also sent via email.
          </p>
          {loadingNotifications ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-amber-500" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-slate-400 text-sm">No checkpoint notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-wrap items-start gap-2 p-4 rounded-xl bg-slate-800/60 border border-slate-700"
                >
                  <MapPin size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-100">
                      Vehicle <span className="font-mono">{n.vehiclePlate}</span> was stopped at a checkpoint.
                    </p>
                    {n.checkpointAddress && (
                      <p className="text-slate-400 text-sm mt-1">
                        Address: {n.checkpointAddress}
                      </p>
                    )}
                    {n.driverName && (
                      <p className="text-slate-400 text-sm">Driver: {n.driverName}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">
                      {n.createdAt?.toDate?.()?.toLocaleString() ||
                        (typeof n.createdAt === 'string' ? n.createdAt : '')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* My vehicles */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Car size={20} />
              My Vehicles
            </h2>
            <button
              type="button"
              onClick={() => { setShowAddVehicle(true); setAddError(''); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
            >
              <PlusCircle size={18} />
              Register vehicle for rental
            </button>
          </div>

          {showAddVehicle && (
            <form
              onSubmit={handleAddVehicle}
              className="mb-6 p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-4"
            >
              <h3 className="font-semibold text-slate-200">Add vehicle</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Plate number</label>
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="ABC 1234"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-50 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Toyota Vios"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-50"
                  >
                    <option>Sedan</option>
                    <option>SUV</option>
                    <option>Van</option>
                    <option>Motorcycle</option>
                  </select>
                </div>
              </div>
              {addError && (
                <p className="text-red-300 text-sm">{addError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60"
                >
                  {addSubmitting ? 'Adding…' : 'Add vehicle'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loadingVehicles ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-emerald-500" />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="py-8 text-center text-slate-400 border border-dashed border-slate-600 rounded-xl">
              <p>No vehicles registered yet. Add a vehicle to offer it for rental.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-semibold text-lg">{vehicle.plateNumber}</p>
                    <p className="text-slate-400 text-sm">
                      {[vehicle.brand, vehicle.series].filter(Boolean).join(' ') || '—'} • {vehicle.vehicleType || 'Vehicle'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleRentalReady(vehicle)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                        vehicle.rentalReady
                          ? 'bg-emerald-600/80 text-emerald-100'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {vehicle.rentalReady ? (
                        <>
                          <CheckCircle2 size={16} />
                          Ready for rental
                        </>
                      ) : (
                        <>
                          <XCircle size={16} />
                          Mark ready for rental
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehiclePlate(vehicle.plateNumber);
                        setShowAuthorize(true);
                        setDriverSearch('');
                        setDriverResults([]);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
                    >
                      <UserCheck size={16} />
                      Authorize driver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Authorize driver modal */}
        {showAuthorize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Authorize driver for {selectedVehiclePlate}</h3>
              <p className="text-slate-400 text-sm mb-4">
                Search by driver name or license number. The driver will be allowed to operate this vehicle (borrowed).
              </p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  placeholder="Driver name or license..."
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-50"
                />
                <button
                  type="button"
                  onClick={searchDrivers}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Search
                </button>
              </div>
              <ul className="space-y-2 max-h-48 overflow-auto">
                {driverResults.map((d) => (
                  <li
                    key={d.uid}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800"
                  >
                    <span className="text-slate-200">{d.fullName}</span>
                    <button
                      type="button"
                      onClick={() => addAuthorization(d.uid, d.fullName)}
                      disabled={authorizeSubmitting}
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
                    >
                      Authorize
                    </button>
                  </li>
                ))}
                {driverResults.length === 0 && driverSearch && (
                  <li className="text-slate-400 text-sm">No drivers found.</li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setShowAuthorize(false);
                  setSelectedVehiclePlate('');
                }}
                className="mt-4 w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
