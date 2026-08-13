import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/shadcn/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/shadcn/ui/field';
import {
  PasswordInput,
  PasswordMatchHint,
  PasswordStrengthIndicator,
} from '@/components/shadcn/password-field';

type ResetPasswordFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  error?: string;
};

export function ResetPasswordForm({
  className,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  onSubmit,
  isSubmitting = false,
  error,
  ...props
}: ResetPasswordFormProps) {
  const { t } = useTranslation();

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">
            {t('auth.resetPassword.title', 'Set a new password')}
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t('auth.resetPassword.subtitle', 'Choose a strong password to secure your account.')}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="password">
            {t('auth.resetPassword.newPassword', 'New password')}
          </FieldLabel>
          <PasswordInput
            id="password"
            value={password}
            onChange={onPasswordChange}
            placeholder={t('auth.resetPassword.newPasswordPlaceholder', 'Enter new password')}
            autoComplete="new-password"
          />
          <PasswordStrengthIndicator password={password} />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">
            {t('auth.resetPassword.confirmNewPassword', 'Confirm new password')}
          </FieldLabel>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={onConfirmPasswordChange}
            placeholder={t(
              'auth.resetPassword.confirmNewPasswordPlaceholder',
              'Re-enter new password',
            )}
            autoComplete="new-password"
          />
          <PasswordMatchHint password={password} confirmPassword={confirmPassword} />
        </Field>

        {error && (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t('auth.resetPassword.resetting', 'Resetting…')
              : t('auth.resetPassword.submit', 'Reset password')}
          </Button>
          <FieldDescription className="text-center">
            {t('auth.resetPassword.rememberPassword', 'Remember your password?')}{' '}
            <Link to="/login-v2" className="underline underline-offset-4">
              {t('common.signIn', 'Sign in')}
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
