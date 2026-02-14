// src/components/auth/ProtectedRoute.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        // Not logged in → go to login
        navigate('/login');
      } else if (allowedRoles && !allowedRoles.includes(userRole)) {
        if (userRole === 'admin') navigate('/admin');
        else if (userRole === 'driver') navigate('/dashboard');
        else if (userRole === 'officer') navigate('/scanner');
        else if (userRole === 'owner') navigate('/owner');
        else navigate('/login');
      }
    }
  }, [currentUser, userRole, loading, navigate, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser || (allowedRoles && !allowedRoles.includes(userRole))) {
    return null; // will be redirected by useEffect
  }

  return children;
}