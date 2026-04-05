import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button, Input, Card, CardContent } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { Eye, EyeOff, CircleAlert, CircleCheck } from 'lucide-react';

type AuthStep = 'email' | 'password';
type AuthMode = 'sign-in' | 'sign-up';

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

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setUserFromApi } = useAuth();

  const state = location.state as {
    from?: { pathname?: string; search?: string };
    email?: string;
  } | null;
  const from = state?.from;
  const returnPath = from ? (from.pathname ?? '/') + (from.search ?? '') : '/';
  const prefilledEmail = state?.email ?? '';

  const [step, setStep] = useState<AuthStep>('email');
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowSignup, setAllowSignup] = useState(true);
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);

  useEffect(() => {
    authService
      .getAuthConfig()
      .then((cfg) => {
        setAllowSignup(cfg.enable_signup);
        setIsSmtpConfigured(cfg.is_smtp_configured);
      })
      .catch(() => {});
  }, []);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);
      try {
        const resp = await authService.emailCheck(email);
        if (resp.existing) {
          setMode('sign-in');
        } else {
          if (!resp.allow_public_signup) {
            setError('Sign-up is by invite only.');
            setIsSubmitting(false);
            return;
          }
          setMode('sign-up');
        }
        setStep('password');
      } catch {
        setStep('password');
        setMode('sign-in');
      } finally {
        setIsSubmitting(false);
      }
    },
    [email],
  );

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (mode === 'sign-up') {
        if (!isPasswordStrong(password)) {
          setError('Password does not meet strength requirements.');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
      }

      setIsSubmitting(true);
      try {
        if (mode === 'sign-in') {
          const success = await login(email, password);
          if (success) {
            navigate(returnPath, { replace: true });
          } else {
            setError('Invalid email or password.');
          }
        } else {
          const user = await authService.signUp({
            email,
            password,
            first_name: firstName,
            last_name: lastName,
          });
          setUserFromApi(user);
          navigate(returnPath, { replace: true });
        }
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { data?: { error?: string } } };
          setError(axiosErr.response?.data?.error ?? 'Something went wrong.');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      mode,
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      login,
      setUserFromApi,
      navigate,
      returnPath,
    ],
  );

  const goBackToEmail = useCallback(() => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setError('');
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'sign-in' ? 'sign-up' : 'sign-in'));
    setPassword('');
    setConfirmPassword('');
    setError('');
  }, []);

  const title = useMemo(() => {
    if (step === 'email') return 'Get started with Devlane';
    return mode === 'sign-in' ? 'Welcome back!' : 'Create your account';
  }, [step, mode]);

  const subtitle = useMemo(() => {
    if (step === 'email') return 'Enter your email to continue.';
    return mode === 'sign-in'
      ? 'Enter your password to sign in.'
      : 'Set up your account to get started.';
  }, [step, mode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) p-4">
      <Card className="w-full max-w-[22.5rem]">
        <CardContent className="p-6">
          <h1 className="mb-1 text-2xl font-semibold text-(--txt-primary)">{title}</h1>
          <p className="mb-6 text-sm text-(--txt-secondary)">{subtitle}</p>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'email' && (
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
                {isSubmitting ? 'Checking…' : 'Continue'}
              </Button>
            </form>
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

              {mode === 'sign-up' && (
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
              )}

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  autoFocus={mode === 'sign-in'}
                />
                <button
                  type="button"
                  className="absolute top-[2.1rem] right-3 text-(--txt-tertiary) hover:text-(--txt-primary)"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {mode === 'sign-up' && <PasswordStrengthIndicator password={password} />}

              {mode === 'sign-up' && (
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
                    tabIndex={-1}
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
              )}

              {mode === 'sign-in' && isSmtpConfigured && (
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    state={{ email }}
                    className="text-xs text-(--txt-accent) hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === 'sign-in'
                    ? 'Signing in…'
                    : 'Creating account…'
                  : mode === 'sign-in'
                    ? 'Sign in'
                    : 'Create account'}
              </Button>

              {allowSignup && (
                <p className="text-center text-sm text-(--txt-secondary)">
                  {mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="font-medium text-(--txt-accent) hover:underline"
                  >
                    {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
