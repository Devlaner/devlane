import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { API_BASE, getApiErrorMessage } from '../api/client';
import { Eye, EyeOff, CircleAlert, CircleCheck } from 'lucide-react';
import { AuthPageShell } from '../components/auth/AuthPageShell';

type AuthStep = 'email' | 'password' | 'code';

interface PasswordCriteria {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

function getPasswordCriteria(pw: string): PasswordCriteria {
  return {
    minLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasDigit: /\d/.test(pw),
    hasSpecial: /[!@#$%^&*()\-_+=[\]{}|;:'",.<>?/]/.test(pw),
  };
}

function isPasswordStrong(pw: string): boolean {
  const c = getPasswordCriteria(pw);
  return c.minLength && c.hasUpper && c.hasLower && c.hasDigit && c.hasSpecial;
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const criteria = getPasswordCriteria(password);
  if (!password) return null;

  const items: [string, boolean][] = [
    ['At least 8 characters', criteria.minLength],
    ['Uppercase letter', criteria.hasUpper],
    ['Lowercase letter', criteria.hasLower],
    ['Number', criteria.hasDigit],
    ['Special character', criteria.hasSpecial],
  ];

  return (
    <div className="mt-2 space-y-1">
      {items.map(([label, met]) => (
        <div key={label} className="flex items-center gap-1.5 text-xs">
          {met ? (
            <CircleCheck className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <CircleAlert className="h-3.5 w-3.5 text-(--txt-tertiary)" />
          )}
          <span className={met ? 'text-green-600' : 'text-(--txt-tertiary)'}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUserFromApi } = useAuth();

  const state = location.state as {
    from?: { pathname?: string; search?: string };
    email?: string;
    inviteToken?: string;
  } | null;
  const from = state?.from;
  const returnPath = from ? (from.pathname ?? '/') + (from.search ?? '') : '/';
  const prefilledEmail = state?.email ?? '';

  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');
  const inviteToken = useMemo(() => {
    const q = searchParams.get('invite')?.trim() ?? '';
    const st = state?.inviteToken?.trim() ?? '';
    return q || st;
  }, [searchParams, state?.inviteToken]);

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [magicCode, setMagicCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowSignup, setAllowSignup] = useState(true);
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);
  const [isPasswordEnabled, setIsPasswordEnabled] = useState(true);
  const [isMagicCodeEnabled, setIsMagicCodeEnabled] = useState(true);
  const [oauthProviders, setOauthProviders] = useState({
    google: false,
    github: false,
    gitlab: false,
  });

  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
    }
  }, [oauthError]);

  useEffect(() => {
    authService
      .getAuthConfig()
      .then((cfg) => {
        setAllowSignup(cfg.enable_signup);
        setIsSmtpConfigured(cfg.is_smtp_configured);
        setIsPasswordEnabled(cfg.is_email_password_enabled);
        setIsMagicCodeEnabled(cfg.is_magic_code_enabled ?? true);
        setOauthProviders({
          google: cfg.is_google_enabled,
          github: cfg.is_github_enabled,
          gitlab: cfg.is_gitlab_enabled,
        });
      })
      .catch(() => {});
  }, []);

  const hasOAuth = oauthProviders.google || oauthProviders.github || oauthProviders.gitlab;

  const canUseMagicCode = isMagicCodeEnabled && isSmtpConfigured && (allowSignup || !!inviteToken);

  const handleOAuth = useCallback(
    (provider: string) => {
      const nextPath = returnPath !== '/' ? `?next_path=${encodeURIComponent(returnPath)}` : '';
      window.location.assign(`${API_BASE}/auth/${provider}/${nextPath}`);
    },
    [returnPath],
  );

  const sendMagicCode = useCallback(async () => {
    await authService.requestMagicCode({
      email,
      ...(inviteToken ? { invite_token: inviteToken } : {}),
    });
  }, [email, inviteToken]);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);
      try {
        const resp = await authService.emailCheck(email);
        if (resp.existing) {
          navigate('/login', { state: { email }, replace: true });
          return;
        }
        if (!resp.allow_public_signup && !inviteToken) {
          setError('Sign-up is by invite only.');
          setIsSubmitting(false);
          return;
        }

        const magicOnly = !isPasswordEnabled && isMagicCodeEnabled && isSmtpConfigured;
        if (magicOnly) {
          try {
            await sendMagicCode();
            setStep('code');
          } catch (err: unknown) {
            setError(getApiErrorMessage(err) || 'Could not send sign-up code.');
          } finally {
            setIsSubmitting(false);
          }
          return;
        }

        setStep('password');
      } catch {
        setStep('password');
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, inviteToken, isPasswordEnabled, isMagicCodeEnabled, isSmtpConfigured, sendMagicCode, navigate],
  );

  const switchToMagicCode = useCallback(async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await sendMagicCode();
      setStep('code');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) || 'Could not send sign-up code.');
    } finally {
      setIsSubmitting(false);
    }
  }, [sendMagicCode]);

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!isPasswordStrong(password)) {
        setError('Password does not meet strength requirements.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setIsSubmitting(true);
      try {
        const user = await authService.signUp({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        });
        setUserFromApi(user);
        navigate(returnPath, { replace: true });
      } catch (err: unknown) {
        setError(getApiErrorMessage(err) || 'Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, password, confirmPassword, firstName, lastName, inviteToken, setUserFromApi, navigate, returnPath],
  );

  const handleMagicCodeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const code = magicCode.replace(/\D/g, '');
      if (code.length !== 6) {
        setError('Enter the 6-digit code from your email.');
        return;
      }
      setIsSubmitting(true);
      try {
        const user = await authService.verifyMagicCode({
          email,
          code,
          first_name: firstName,
          last_name: lastName,
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        });
        setUserFromApi(user);
        navigate(returnPath, { replace: true });
      } catch (err: unknown) {
        setError(getApiErrorMessage(err) || 'Invalid or expired code.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [magicCode, email, firstName, lastName, inviteToken, setUserFromApi, navigate, returnPath],
  );

  const goBackToEmail = useCallback(() => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setMagicCode('');
    setError('');
  }, []);

  const goBackToPassword = useCallback(() => {
    setStep('password');
    setMagicCode('');
    setError('');
  }, []);

  if (!allowSignup && !inviteToken) {
    return (
      <AuthPageShell mode="sign-up" enableSignup={false}>
        <div className="w-full max-w-[22.5rem]">
          <h1 className="mb-1 text-2xl font-semibold text-(--txt-primary)">Sign up is disabled</h1>
          <p className="mb-6 text-sm text-(--txt-secondary)">
            Public sign-up is currently disabled. Please contact your administrator.
          </p>
          <Link to="/login" className="text-sm font-medium text-(--txt-accent) hover:underline">
            Go to sign in
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  const title = step === 'email' ? 'Create your account' : step === 'code' ? 'Verify your email' : 'Create your account';
  const subtitle =
    step === 'email'
      ? 'Enter your email to get started.'
      : step === 'code'
        ? 'We sent a 6-digit code to your inbox. It expires in 10 minutes.'
        : 'Set up your account to get started.';

  return (
    <AuthPageShell mode="sign-up" enableSignup={allowSignup}>
      <div className="w-full max-w-[22.5rem]">
        <h1 className="mb-1 text-2xl font-semibold text-(--txt-primary)">{title}</h1>
        <p className="mb-6 text-sm text-(--txt-secondary)">{subtitle}</p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'email' && (
          <>
            {hasOAuth && (
              <div className="mb-4 flex flex-col gap-2">
                {oauthProviders.google && (
                  <button
                    type="button"
                    onClick={() => handleOAuth('google')}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-(--border-primary) px-4 py-2 text-sm font-medium text-(--txt-primary) hover:bg-(--bg-subtle) transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign up with Google
                  </button>
                )}
                {oauthProviders.github && (
                  <button
                    type="button"
                    onClick={() => handleOAuth('github')}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-(--border-primary) px-4 py-2 text-sm font-medium text-(--txt-primary) hover:bg-(--bg-subtle) transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    Sign up with GitHub
                  </button>
                )}
                {oauthProviders.gitlab && (
                  <button
                    type="button"
                    onClick={() => handleOAuth('gitlab')}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-(--border-primary) px-4 py-2 text-sm font-medium text-(--txt-primary) hover:bg-(--bg-subtle) transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.386 9.452.044 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.625-8.443a.92.92 0 0 0 .33-1.024" />
                    </svg>
                    Sign up with GitLab
                  </button>
                )}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-(--border-primary)" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-(--bg-primary) px-2 text-(--txt-tertiary)">or</span>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Checking…' : 'Continue with email'}
              </Button>
            </form>
          </>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div>
              <button
                type="button"
                onClick={goBackToEmail}
                className="mb-3 flex items-center gap-1 text-xs text-(--txt-tertiary) hover:text-(--txt-primary)"
              >
                <span>←</span>
                <span>{email}</span>
              </button>
            </div>

            <div className="flex gap-3">
              <Input
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                autoFocus
              />
              <Input
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute top-[2.1rem] right-3 text-(--txt-tertiary) hover:text-(--txt-primary)"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <PasswordStrengthIndicator password={password} />

            <div className="relative">
              <Input
                label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute top-[2.1rem] right-3 text-(--txt-tertiary) hover:text-(--txt-primary)"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                aria-pressed={showConfirm}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                  <CircleCheck className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            {canUseMagicCode && isPasswordEnabled && (
              <button
                type="button"
                onClick={() => void switchToMagicCode()}
                disabled={isSubmitting}
                className="w-full text-center text-xs font-medium text-(--txt-accent) hover:underline disabled:opacity-50"
              >
                Sign up with email code instead
              </button>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleMagicCodeSubmit} className="flex flex-col gap-4">
            <div>
              <button
                type="button"
                onClick={goBackToEmail}
                className="mb-3 flex items-center gap-1 text-xs text-(--txt-tertiary) hover:text-(--txt-primary)"
              >
                <span>←</span>
                <span>{email}</span>
              </button>
            </div>

            <div className="flex gap-3">
              <Input
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                autoFocus
              />
              <Input
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>

            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={magicCode}
              onChange={(e) => setMagicCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              maxLength={6}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Verifying…' : 'Continue'}
            </Button>

            <button
              type="button"
              onClick={() => void switchToMagicCode()}
              disabled={isSubmitting}
              className="w-full text-center text-xs text-(--txt-accent) hover:underline disabled:opacity-50"
            >
              Resend code
            </button>

            {isPasswordEnabled && (
              <button
                type="button"
                onClick={goBackToPassword}
                className="w-full text-center text-xs text-(--txt-tertiary) hover:text-(--txt-primary)"
              >
                Use password instead
              </button>
            )}
          </form>
        )}
      </div>
    </AuthPageShell>
  );
}
