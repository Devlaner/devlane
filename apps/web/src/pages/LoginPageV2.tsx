import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { LoginForm } from '@/components/shadcn/login-form';
import { PrismGradient } from '@/components/shadcn/ui/prism-gradient';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function LoginPageV2() {
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
    <div className="shadcn-reference relative min-h-svh overflow-hidden">
      {/* The gradient backs the whole page rather than one column, so both the
          copy and the form card sit over it. */}
      <PrismGradient noise={{ opacity: 0.18, scale: 0.8 }} />
      {/* The gradient runs light in places, which would swallow the white copy
          on the left. This scrim darkens that half just enough to keep the
          text legible without hiding the animation behind it. */}
      <div
        className="absolute inset-0 z-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(90deg, hsl(0 0% 0% / 0.55) 0%, hsl(0 0% 0% / 0.4) 55%, hsl(0 0% 0% / 0.45) 100%)',
        }}
      />

      <div className="relative z-10 grid min-h-svh lg:grid-cols-[48fr_52fr]">
        {/* Copy column. Hidden below lg, where the form takes the full width. */}
        <div className="hidden flex-col justify-between p-10 lg:flex">
          <Link to="/" className="flex w-fit items-center gap-2.5">
            <img src="/devlane-2-dark-no-bg.png" alt="" className="size-7 object-contain" />
            <span className="text-lg font-semibold text-white">Devlane</span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-5xl leading-[0.95] tracking-tighter text-white">
              <span className="block font-serif font-light italic">
                {t('auth.login.heroTitle1', 'Plan the work.')}
              </span>
              <span className="block font-bold">
                {t('auth.login.heroTitle2', 'Ship the product.')}
              </span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              {t(
                'auth.login.heroDescription',
                'Issue tracking and project management for development teams. Organise work into projects, cycles, and modules, and keep everyone on the same page.',
              )}
            </p>
          </div>

          <p className="text-xs text-white/60">
            {t('auth.copyright', '© {{year}} Devlane. All rights reserved.', {
              year: new Date().getFullYear(),
            })}
          </p>
        </div>

        <div className="flex items-center justify-center p-6 md:p-10">
          {/* No card: the form sits straight on the gradient. It still needs
              the on-glass palette, since the backdrop is dark in every theme
              and the default near-black text would drop out against it. */}
          <div className="shadcn-reference-on-glass w-full max-w-sm">
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
          </div>
        </div>
      </div>
    </div>
  );
}
