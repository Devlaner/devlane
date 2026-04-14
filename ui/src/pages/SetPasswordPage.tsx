import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../api/client';
import { Eye, EyeOff, CircleAlert, CircleCheck } from 'lucide-react';
import { AuthPageShell } from '../components/auth/AuthPageShell';

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

export function SetPasswordPage() {
  const navigate = useNavigate();
  const { user, setUserFromApi } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = useMemo(
    () => confirmPassword.length > 0 && password === confirmPassword,
    [password, confirmPassword],
  );

  const isDisabled = !isPasswordStrong(password) || !passwordsMatch || isSubmitting;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!isPasswordStrong(password)) {
        setError('Password does not meet strength requirements.');
        return;
      }
      if (!passwordsMatch) {
        setError('Passwords do not match.');
        return;
      }

      setIsSubmitting(true);
      try {
        const updated = await authService.setPassword({ password });
        setUserFromApi(updated);
        navigate('/', { replace: true });
      } catch (err: unknown) {
        setError(getApiErrorMessage(err) || 'Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, passwordsMatch, setUserFromApi, navigate],
  );

  return (
    <AuthPageShell mode="sign-in" enableSignup={false}>
      <div className="w-full max-w-[22.5rem]">
        <h1 className="mb-1 text-2xl font-semibold text-(--txt-primary)">Set password</h1>
        <p className="mb-6 text-sm text-(--txt-secondary)">Create a new password.</p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={user?.email ?? ''}
            disabled
            autoComplete="off"
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="new-password"
              autoFocus
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
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <CircleCheck className="h-3 w-3" /> Passwords match
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isDisabled}>
            {isSubmitting ? 'Setting password…' : 'Continue'}
          </Button>
        </form>
      </div>
    </AuthPageShell>
  );
}
