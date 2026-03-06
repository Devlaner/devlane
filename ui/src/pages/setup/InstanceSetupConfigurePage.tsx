import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { instanceService } from '../../services/instanceService';
import { getApiErrorMessage } from '../../api/client';

const LogoMark = () => (
  <span
    className="flex size-9 items-center justify-center rounded-lg bg-[var(--bg-accent-primary)] text-[var(--txt-on-color)]"
    aria-hidden
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 9h9l-7 5 2.5 8-7.5-5.5-7.5 5.5 2.5-8-7-5h9z" />
    </svg>
  </span>
);

const IconEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.576 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-4.355" />
    <path d="m2 2 20 20" />
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
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
    [password]
  );
}

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--txt-secondary)]">
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
          met ? 'bg-[var(--bg-success-primary)] text-[var(--txt-on-color)]' : 'bg-[var(--bg-layer-1)] text-[var(--txt-placeholder)]'
        }`}
        aria-hidden
      >
        {met ? <IconCheck /> : null}
      </span>
      <span>{label}</span>
    </div>
  );
}

export function InstanceSetupConfigurePage() {
  const navigate = useNavigate();
  const { setUserFromApi } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [allowUsageData, setAllowUsageData] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const req = usePasswordRequirements(password);
  const allMet = req.minLength && req.upper && req.lower && req.number && req.special;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (!companyName.trim()) {
      setError('Please enter your company name.');
      return;
    }
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
      const user = await instanceService.completeSetup({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        company_name: companyName.trim() || undefined,
      });
      setUserFromApi(user);
      navigate('/setup/complete', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)]">
      <header className="shrink-0 px-6 py-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--txt-primary)]">
          <LogoMark />
          Devlane
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <h1 className="text-center text-xl font-semibold text-[var(--txt-primary)]">
            Setup your Devlane instance
          </h1>
          <p className="mt-2 text-center text-sm text-[var(--txt-secondary)]">
            Post setup you will be able to manage this Devlane instance.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First name *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Wilber"
                required
                autoComplete="given-name"
              />
              <Input
                label="Last name *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Wright"
                required
                autoComplete="family-name"
              />
            </div>
            <Input
              label="Email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoComplete="email"
            />
            <Input
              label="Company name *"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              required
              autoComplete="organization"
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="setup-password" className="text-sm font-medium text-[var(--txt-secondary)]">
                Set a password *
              </label>
              <div className="relative">
                <input
                  id="setup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password..."
                  required
                  autoComplete="new-password"
                  className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-2 pl-3 pr-10 text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <PasswordRequirement met={req.minLength} label="Min 8 characters" />
                <PasswordRequirement met={req.upper} label="Min 1 upper-case letter" />
                <PasswordRequirement met={req.lower} label="Min 1 lower-case letter" />
                <PasswordRequirement met={req.number} label="Min 1 number" />
                <PasswordRequirement met={req.special} label="Min 1 special character" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="setup-confirm-password" className="text-sm font-medium text-[var(--txt-secondary)]">
                Confirm password *
              </label>
              <div className="relative">
                <input
                  id="setup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                  autoComplete="new-password"
                  className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-2 pl-3 pr-10 text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={allowUsageData}
                onChange={(e) => setAllowUsageData(e.target.checked)}
                className="mt-0.5 size-4 rounded border-[var(--border-subtle)] bg-[var(--bg-surface-1)] text-[var(--bg-accent-primary)] focus:ring-[var(--border-accent-strong)]"
              />
              <span className="text-[var(--txt-secondary)]">
                Allow Devlane to anonymously collect usage events.{' '}
                <a href="#" className="text-[var(--txt-accent-primary)] underline hover:no-underline">
                  See more
                </a>
              </span>
            </label>

            {error && (
              <p className="text-sm text-[var(--txt-danger-primary)]">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Setting up…' : 'Continue'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
