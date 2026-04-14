import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, CardContent, Button } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { workspaceService } from '../services/workspaceService';

const IconGlobe = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="shrink-0 text-(--txt-icon-secondary)"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    <path d="M2 12h20" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconEye = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

function usePasswordRequirements(password: string) {
  return useMemo(
    () => ({
      minLength: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    }),
    [password],
  );
}

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-(--txt-secondary)">
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
          met
            ? 'bg-(--bg-success-primary) text-(--txt-on-color)'
            : 'bg-(--bg-layer-1) text-(--txt-placeholder)'
        }`}
        aria-hidden
      >
        {met ? <IconCheck /> : null}
      </span>
      <span>{label}</span>
    </div>
  );
}

export function InviteSignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUserFromApi, user } = useAuth();

  const state = location.state as {
    email?: string;
    token?: string;
    workspaceName?: string;
    workspaceSlug?: string;
  } | null;

  const email = (state?.email ?? '').trim();
  const token = (state?.token ?? '').trim();
  const workspaceName = state?.workspaceName ?? 'the workspace';
  const workspaceSlug = (state?.workspaceSlug ?? '').trim();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const req = usePasswordRequirements(password);
  const allMet = req.minLength && req.upper && req.lower && req.number && req.special;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    if (!email || !token) {
      navigate('/', { replace: true });
    }
  }, [email, token, navigate]);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!allMet) {
      setError('Please meet all password requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const apiUser = await authService.signUp({
        email,
        password,
        invite_token: token,
      });
      setUserFromApi(apiUser);
      await workspaceService.joinByToken(token);
      navigate(`/${workspaceSlug}`, { replace: true });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setError(message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!email || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) p-4">
        <p className="text-sm text-(--txt-tertiary)">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-(--txt-primary)">
            <span className="text-(--txt-secondary)">Join</span>
            <IconGlobe />
            <span>{workspaceName}</span>
          </h1>
          <p className="mt-2 text-sm text-(--txt-secondary)">
            Set a password to create your account and join the workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-1) px-3 py-2 text-sm text-(--txt-secondary) focus:outline-none"
                aria-readonly
              />
            </div>

            <div>
              <label
                htmlFor="invite-signup-password"
                className="mb-1 block text-sm font-medium text-(--txt-secondary)"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="invite-signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) py-2 pl-3 pr-9 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                <PasswordRequirement met={req.minLength} label="Min 8 characters" />
                <PasswordRequirement met={req.upper} label="One uppercase" />
                <PasswordRequirement met={req.lower} label="One lowercase" />
                <PasswordRequirement met={req.number} label="Min 1 number" />
                <PasswordRequirement met={req.special} label="Min 1 special" />
              </div>
            </div>

            <div>
              <label
                htmlFor="invite-signup-confirm"
                className="mb-1 block text-sm font-medium text-(--txt-secondary)"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="invite-signup-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) py-2 pl-3 pr-9 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                  aria-label={
                    showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                  }
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-(--txt-destructive)">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !allMet || !passwordsMatch}
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-(--txt-secondary)">
            Already have an account?{' '}
            <Link
              to="/login"
              state={{
                from: { pathname: '/invite', search: `?token=${token}` },
                email,
              }}
              className="font-medium text-(--txt-accent) hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
