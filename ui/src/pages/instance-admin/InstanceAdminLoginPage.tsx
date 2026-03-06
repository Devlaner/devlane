import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, IconEye, IconEyeOff, Input } from '../../components/ui';

const INSTANCE_ADMIN_KEY = 'devlane_instance_admin';

const IconGlobe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);
export function InstanceAdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // Mock: accept any non-empty email + password for instance admin
    if (email.trim() && password) {
      sessionStorage.setItem(INSTANCE_ADMIN_KEY, '1');
      navigate('/instance-admin/general', { replace: true });
    } else {
      setError('Please enter your email and password.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)]">
      {/* Top-left branding */}
      <header className="shrink-0 px-6 py-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--txt-primary)]">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--bg-layer-2)] text-[var(--txt-icon-secondary)]">
            <IconGlobe />
          </span>
          Devlane
        </div>
      </header>

      {/* Centered form */}
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-xl font-semibold text-[var(--txt-primary)]">
            Manage your Devlane instance
          </h1>
          <p className="mt-2 text-center text-sm text-[var(--txt-secondary)]">
            Configure instance-wide settings to secure your instance.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <Input
              label="Email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoComplete="email"
              className="w-full"
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="instance-admin-password" className="text-sm font-medium text-[var(--txt-secondary)]">
                Password *
              </label>
              <div className="relative">
                <input
                  id="instance-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
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
              {error && (
                <span className="text-xs text-[var(--txt-danger-primary)]">{error}</span>
              )}
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
