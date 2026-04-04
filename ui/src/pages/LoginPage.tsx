import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { IconEye, IconEyeOff } from '../components/ui/PasswordRevealIcons';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

type AuthMode = 'sign-in' | 'sign-up';

function getPasswordStrength(password: string) {
  const checks = {
    minLength: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, valid: passed === 5 };
}

const IconCheck = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function PasswordStrengthIndicator({ password }: { password: string }) {
  const { checks, passed } = getPasswordStrength(password);
  if (!password) return null;

  const barColor =
    passed <= 1
      ? 'bg-red-500'
      : passed <= 2
        ? 'bg-orange-500'
        : passed <= 3
          ? 'bg-yellow-500'
          : passed <= 4
            ? 'bg-lime-500'
            : 'bg-green-500';

  const criteria = [
    { met: checks.minLength, label: 'Min 8 characters' },
    { met: checks.upper, label: 'Uppercase letter' },
    { met: checks.lower, label: 'Lowercase letter' },
    { met: checks.number, label: 'A number' },
    { met: checks.special, label: 'A special character' },
  ];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < passed ? barColor : 'bg-(--border-subtle)'}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
        {criteria.map(({ met, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-(--txt-secondary)">
            <span
              className={`flex size-3.5 shrink-0 items-center justify-center rounded-full ${
                met
                  ? 'bg-green-500 text-white'
                  : 'border border-(--border-subtle) text-transparent'
              }`}
            >
              <IconCheck />
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const state = location.state as {
    from?: { pathname?: string; search?: string };
    email?: string;
  } | null;
  const from = state?.from;
  const returnPath = from ? (from.pathname ?? '/') + (from.search ?? '') : '/';
  const prefilledEmail = state?.email ?? '';

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

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const clearForm = useCallback(() => {
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setShowPassword(false);
    setShowConfirm(false);
    setError('');
  }, []);

  const toggleMode = useCallback(() => {
    clearForm();
    setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'));
  }, [clearForm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'sign-up') {
      if (!strength.valid) {
        setError('Please meet all password requirements.');
        return;
      }
      if (!passwordsMatch) {
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
        await authService.signUp({
          email,
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });
        const success = await login(email, password);
        if (success) {
          navigate(returnPath, { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSignUp = mode === 'sign-up';

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto bg-(--bg-canvas) px-6 pt-16 pb-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-(--txt-primary)">Devlane</h1>
      </div>

      <div className="w-full max-w-[22.5rem]">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-(--txt-primary)">
            {isSignUp ? 'Create your account' : 'Sign in to Devlane'}
          </h2>
          <p className="mt-1 text-sm text-(--txt-secondary)">
            {isSignUp
              ? 'Start managing your projects with Devlane.'
              : 'Enter your credentials to continue.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-(--radius-md) border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
            autoComplete="email"
          />

          {isSignUp && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Shabnam"
                autoComplete="given-name"
              />
              <Input
                label="Last name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Aliyeva"
                autoComplete="family-name"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1 block text-sm font-medium text-(--txt-secondary)"
            >
              {isSignUp ? 'Set a password' : 'Password'}
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? 'Create a password' : 'Enter password'}
                required
                minLength={isSignUp ? 8 : undefined}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) py-2 pl-3 pr-10 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {!isSignUp && (
              <div className="mt-1.5 text-right">
                <Link
                  to="/forgot-password"
                  state={{ email }}
                  className="text-xs font-medium text-(--txt-accent) hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
            )}
            {isSignUp && <PasswordStrengthIndicator password={password} />}
          </div>

          {isSignUp && (
            <div>
              <label
                htmlFor="auth-confirm"
                className="mb-1 block text-sm font-medium text-(--txt-secondary)"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="auth-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) py-2 pl-3 pr-10 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirm ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p
                  className={`mt-1 text-xs ${
                    passwordsMatch ? 'text-green-600' : 'text-(--txt-destructive)'
                  }`}
                >
                  {passwordsMatch ? 'Passwords match' : "Passwords don't match"}
                </p>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting || (isSignUp && (!strength.valid || !passwordsMatch))
            }
          >
            {isSubmitting
              ? isSignUp
                ? 'Creating account…'
                : 'Signing in…'
              : isSignUp
                ? 'Create account'
                : 'Continue'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-(--txt-secondary)">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-medium text-(--txt-accent) hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>

      <div className="mt-auto pt-10 text-center text-xs text-(--txt-placeholder)">
        By signing up, you agree to the Terms of Service and Privacy Policy.
      </div>
    </div>
  );
}
