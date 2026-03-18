import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/types';

interface RouteGuardProps {
  allowedRoles?: Role[];
}

const RouteGuard = ({ allowedRoles }: RouteGuardProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    switch (user.role) {
      case 'ADMIN': return <Navigate to="/admin/dashboard" replace />;
      case 'DESIGNER': return <Navigate to="/designer/dashboard" replace />;
      case 'OPERATIONS': return <Navigate to="/operations/dashboard" replace />;
    }
  }

  return <Outlet />;
};

export default RouteGuard;
