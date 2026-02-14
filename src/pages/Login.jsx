import { useState } from 'react';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { auth, db } from '../firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, AlertCircle, Info } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState('LOGIN'); // 'LOGIN' | 'RESET'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let normalizedEmail = email.trim().toLowerCase();
      // Default admin: username LTOAdmin → LTOAdmin@ltms.gov.ph
      if (normalizedEmail === 'ltoadmin') {
        normalizedEmail = 'ltoadmin@ltms.gov.ph';
      }
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const uid = userCredential.user.uid;

      // Resolve role from Firestore (same order as AuthContext)
      const [adminSnap, officerSnap, ownerSnap, driverSnap] = await Promise.all([
        getDoc(doc(db, 'admins', uid)),
        getDoc(doc(db, 'officers', uid)),
        getDoc(doc(db, 'vehicleOwners', uid)),
        getDoc(doc(db, 'drivers', uid)),
      ]);

      if (adminSnap.exists()) {
        navigate('/admin');
        return;
      }
      if (officerSnap.exists()) {
        navigate('/scanner');
        return;
      }
      if (ownerSnap.exists()) {
        navigate('/owner');
        return;
      }
      if (driverSnap.exists()) {
        const data = driverSnap.data();
        if (data.isFirstLogin) {
          setStep('RESET');
        } else {
          navigate('/dashboard');
        }
        return;
      }

      setError('Account not found. Please contact your administrator.');
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      await updateDoc(doc(db, 'drivers', auth.currentUser.uid), { isFirstLogin: false });
      navigate('/dashboard');
    } catch (err) {
      setError('Password reset failed. Ensure it is at least 6 characters.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_55%),_radial-gradient(circle_at_bottom,_#0f766e_0,_transparent_55%)] opacity-40 -z-10" />

      <div className="bg-white/10 backdrop-blur-2xl rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/10">
        <div className="p-8 pb-4 text-center border-b border-white/10 bg-gradient-to-b from-white/10 to-transparent">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl mb-4 border border-blue-500/30">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">LTMS QR VERIFICATION</h1>
          <p className="text-slate-200/80 text-sm mt-2 font-medium">
            Secure Driver & Vehicle Access
          </p>
        </div>

        <div className="p-8 pt-5">
          {step === 'LOGIN' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-2 ml-1">
                  Username / Email
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-slate-600/80 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-500/40 text-slate-50 placeholder:text-slate-500 outline-none transition-all font-mono tracking-wide"
                    placeholder="Email or LTOAdmin for admin"
                    required
                    autoComplete="email"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Use the email provided by your administrator.
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-100 text-xs">
                <Info className="flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="font-semibold mb-1">First time logging in?</p>
                  <p className="text-blue-200/90">
                    <strong>Admin:</strong> user <span className="font-mono">LTOAdmin</span>, password <span className="font-mono">admin123</span>.
                    <strong> Drivers:</strong> username is the email given by admin (e.g. <span className="font-mono">FirstnameLastname@fake.ltms.com</span>); default password is the <strong>last 6 digits of your license number</strong>. You can change your password after first login.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-2 ml-1">
                  Access Password
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-slate-600/80 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-500/40 text-slate-50 placeholder:text-slate-500 outline-none transition-all"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-100 bg-red-900/60 border border-red-500/50 p-3 rounded-lg text-xs font-semibold">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-900/50 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Authenticating…' : 'Sign In'}
              </button>

              <p className="text-center text-slate-400 text-[11px] mt-3">
                Accounts are created by your administrator. Contact admin if you need access.
              </p>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-5 animate-in slide-in-from-right duration-300">
              <div className="bg-amber-500/10 border-l-4 border-amber-400 p-4 mb-2 rounded-r-lg">
                <p className="text-amber-200 text-xs font-bold uppercase tracking-wide">Action Required</p>
                <p className="text-amber-100 text-sm mt-1">
                  Set a new secure password to complete your first login.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-2 ml-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3.5 bg-slate-900/60 border border-slate-600/80 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-500/40 text-slate-50 outline-none"
                  placeholder="At least 6 characters"
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-100 bg-red-900/60 border border-red-500/50 p-3 rounded-lg text-xs font-semibold">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-lime-500 hover:from-emerald-500 hover:to-lime-400 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-900/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating…' : 'Update & Continue'}
              </button>
            </form>
          )}

          <p className="text-center text-slate-400 text-[10px] mt-8 uppercase font-bold tracking-[0.25em]">
            Official Prototype • 2026
          </p>
        </div>
      </div>
    </div>
  );
}