import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface InstanceAdminProtectedRouteProps {
  children: React.ReactNode;
}

export function InstanceAdminProtectedRoute({ children }: InstanceAdminProtectedRouteProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user?.isInstanceAdmin) {
    return <Navigate to="/" state={{ notAuthorized: true }} replace />;
  }

  return <>{children}</>;
}
