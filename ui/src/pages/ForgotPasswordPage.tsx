import { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Input, Card, CardContent } from '../components/ui';
import { authService } from '../services/authService';
import { CircleAlert, CircleCheck, ArrowLeft } from 'lucide-react';

const RESEND_COOLDOWN_SECONDS = 30;

export function ForgotPasswordPage() {
  const location = useLocation();
  const prefilledEmail = (location.state as { email?: string } | null)?.email ?? '';

  const [email, setEmail] = useState(prefilledEmail);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);
      try {
        await authService.forgotPassword({ email });
        setSuccess(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [email],
  );

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setError('');
    setIsSubmitting(true);
    try {
      await authService.forgotPassword({ email });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, cooldown]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) p-4">
      <Card className="w-full max-w-[22.5rem]">
        <CardContent className="p-6">
          <Link
            to="/login"
            className="mb-4 flex items-center gap-1 text-xs text-(--txt-tertiary) hover:text-(--txt-primary)"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>

          <h1 className="mb-1 text-2xl font-semibold text-(--txt-primary)">Reset your password</h1>
          <p className="mb-6 text-sm text-(--txt-secondary)">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                If <strong>{email}</strong> is registered, you&apos;ll receive a reset link shortly.
                Check your inbox and spam folder.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={success && cooldown > 0}
              autoFocus
            />

            {!success ? (
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={cooldown > 0 || isSubmitting}
                onClick={handleResend}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend reset link'}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
