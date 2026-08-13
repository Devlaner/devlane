import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Where to send an unauthenticated visitor. Defaults to the v1 login page;
   * v2 routes pass '/login-v2' so an expired session doesn't drop the user
   * back into v1 chrome mid-flow. */
  signInPath?: string;
}

export function ProtectedRoute({ children, signInPath = '/login' }: ProtectedRouteProps) {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={signInPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
