import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { LoginForm } from '@/v2/components/login-form';
import { AuthPageShellV2 } from '@/v2/components/auth-page-shell';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../api/client';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const state = location.state as {
    from?: { pathname?: string; search?: string };
    email?: string;
    inviteToken?: string;
  } | null;
  const from = state?.from;
  const returnPath = from ? (from.pathname ?? '/') + (from.search ?? '') : '/';

  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');

  const [email, setEmail] = useState(state?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);

  useDocumentTitle(t('auth.login.documentTitle', 'Sign in'));

  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
    }
  }, [oauthError]);

  // This variant signs in with a password only, so the auth config is read for
  // one thing: whether password reset is reachable (it needs SMTP).
  useEffect(() => {
    authService
      .getAuthConfig()
      .then((cfg) => setIsSmtpConfigured(cfg.is_smtp_configured))
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);
      try {
        await login(email, password);
        navigate(returnPath, { replace: true });
      } catch (err: unknown) {
        setError(
          getApiErrorMessage(err) ||
            t('common.genericError', 'Something went wrong. Please try again.'),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, password, login, navigate, returnPath, t],
  );

  return (
    <AuthPageShellV2
      heroTitle1={t('auth.login.heroTitle1', 'Plan the work.')}
      heroTitle2={t('auth.login.heroTitle2', 'Ship the product.')}
      heroDescription={t(
        'auth.login.heroDescription',
        'Issue tracking and project management for development teams. Organise work into projects, cycles, and modules, and keep everyone on the same page.',
      )}
    >
      <LoginForm
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
        canResetPassword={isSmtpConfigured}
      />
    </AuthPageShellV2>
  );
}
