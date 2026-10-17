import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/v2/components/ui/alert';
import { Button } from '@/v2/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/v2/components/ui/field';
import { Input } from '@/v2/components/ui/input';

type ForgotPasswordFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
  isSubmitting?: boolean;
  error?: string;
  success: boolean;
  cooldown: number;
};

export function ForgotPasswordForm({
  className,
  email,
  onEmailChange,
  onSubmit,
  onResend,
  isSubmitting = false,
  error,
  success,
  cooldown,
  ...props
}: ForgotPasswordFormProps) {
  const { t } = useTranslation();

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <Link
          to="/login-v2"
          className="text-muted-foreground hover:text-foreground -mb-2 flex w-fit items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          {t('auth.forgotPassword.backToSignIn', 'Back to sign in')}
        </Link>

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">
            {t('auth.forgotPassword.title', 'Reset your password')}
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t(
              'auth.forgotPassword.subtitle',
              "Enter your email and we'll send you a link to reset your password.",
            )}
          </p>
        </div>

        {success && (
          <Alert>
            <CircleCheck className="text-green-500" />
            <AlertDescription>
              <Trans
                i18nKey="auth.forgotPassword.successMessage"
                defaults="If <b>{{email}}</b> is registered, you'll receive a reset link shortly. Check your inbox and spam folder."
                values={{ email }}
                components={{ b: <strong /> }}
              />
            </AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="email">{t('common.email', 'Email')}</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t('common.emailPlaceholder', 'you@example.com')}
            autoComplete="email"
            required
            autoFocus
            disabled={success && cooldown > 0}
          />
        </Field>

        {error && (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        )}

        <Field>
          {!success ? (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('auth.forgotPassword.sending', 'Sending…')
                : t('auth.forgotPassword.sendResetLink', 'Send reset link')}
            </Button>
          ) : (
            <Button type="button" disabled={cooldown > 0 || isSubmitting} onClick={onResend}>
              {cooldown > 0
                ? t('auth.forgotPassword.resendIn', 'Resend in {{count}}s', { count: cooldown })
                : t('auth.forgotPassword.resendResetLink', 'Resend reset link')}
            </Button>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
}
