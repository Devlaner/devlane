import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { authService } from '../services/authService';

const RESEND_COOLDOWN_SECONDS = 30;

export function ForgotPasswordPage() {
  const location = useLocation();
  const prefilledEmail =
    (location.state as { email?: string } | null)?.email ?? '';

  const [email, setEmail] = useState(prefilledEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await authService.forgotPassword({ email });
      setSubmitted(true);
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await authService.forgotPassword({ email });
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto bg-(--bg-canvas) px-6 pt-16 pb-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-(--txt-primary)">Devlane</h1>
      </div>

      <div className="w-full max-w-[22.5rem]">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-(--txt-primary)">Reset your password</h2>
          <p className="mt-1 text-sm text-(--txt-secondary)">
            Enter the email address associated with your account and we&apos;ll send you a link to
            reset your password.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-(--radius-md) border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {submitted && (
          <div className="mb-4 flex items-start gap-2 rounded-(--radius-md) border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a reset link.
              Check your inbox (and spam folder).
            </span>
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
            disabled={countdown > 0}
          />

          {submitted ? (
            <Button
              type="button"
              className="w-full"
              disabled={isSubmitting || countdown > 0}
              onClick={handleResend}
            >
              {countdown > 0
                ? `Resend in ${countdown}s`
                : isSubmitting
                  ? 'Sending…'
                  : 'Resend reset link'}
            </Button>
          ) : (
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          )}
        </form>

        <p className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="font-medium text-(--txt-accent) hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
