import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/v2/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/v2/components/ui/field';
import { Input } from '@/v2/components/ui/input';
import { PasswordInput, PasswordStrengthIndicator } from '@/v2/components/password-field';

type InviteSignUpFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  workspaceName: string;
  email: string;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  error?: string;
  isDisabled: boolean;
  onSignIn: () => void;
};

export function InviteSignUpForm({
  className,
  workspaceName,
  email,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  onSubmit,
  isSubmitting = false,
  error,
  isDisabled,
  onSignIn,
  ...props
}: InviteSignUpFormProps) {
  const { t } = useTranslation();

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
            <span className="text-muted-foreground">{t('common.join', 'Join')}</span>
            <Globe className="size-5 shrink-0" />
            <span>{workspaceName}</span>
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t(
              'auth.inviteSignUp.subtitle',
              'Set a password to create your account and join the workspace.',
            )}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="email">{t('common.email', 'Email')}</FieldLabel>
          <Input id="email" type="email" value={email} readOnly aria-readonly />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">{t('common.password', 'Password')}</FieldLabel>
          <PasswordInput
            id="password"
            value={password}
            onChange={onPasswordChange}
            placeholder={t('auth.inviteSignUp.passwordPlaceholder', 'Create a password')}
            autoComplete="new-password"
          />
          <PasswordStrengthIndicator password={password} />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">
            {t('common.confirmPassword', 'Confirm password')}
          </FieldLabel>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={onConfirmPasswordChange}
            placeholder={t('auth.inviteSignUp.confirmPasswordPlaceholder', 'Confirm password')}
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={isDisabled}>
            {isSubmitting
              ? t('common.creatingAccount', 'Creating account…')
              : t('common.createAccount', 'Create account')}
          </Button>
        </Field>

        <p className="text-muted-foreground text-center text-sm">
          {t('auth.inviteSignUp.haveAccount', 'Already have an account?')}{' '}
          <button type="button" onClick={onSignIn} className="underline underline-offset-4">
            {t('common.signIn', 'Sign in')}
          </button>
        </p>
      </FieldGroup>
    </form>
  );
}
