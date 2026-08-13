import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/shadcn/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/shadcn/ui/field';
import { Input } from '@/components/shadcn/ui/input';
import {
  PasswordInput,
  PasswordMatchHint,
  PasswordStrengthIndicator,
} from '@/components/shadcn/password-field';

type SetPasswordFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  email: string;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  error?: string;
  isDisabled: boolean;
};

export function SetPasswordForm({
  className,
  email,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  onSubmit,
  isSubmitting = false,
  error,
  isDisabled,
  ...props
}: SetPasswordFormProps) {
  const { t } = useTranslation();

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t('auth.setPassword.title', 'Set password')}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t('auth.setPassword.subtitle', 'Create a new password.')}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="email">{t('common.email', 'Email')}</FieldLabel>
          <Input id="email" type="email" value={email} disabled autoComplete="off" />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">{t('common.password', 'Password')}</FieldLabel>
          <PasswordInput
            id="password"
            value={password}
            onChange={onPasswordChange}
            placeholder={t('auth.setPassword.passwordPlaceholder', 'Enter password')}
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
            placeholder={t('auth.setPassword.confirmPasswordPlaceholder', 'Re-enter password')}
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
          <Button type="submit" disabled={isDisabled}>
            {isSubmitting
              ? t('auth.setPassword.setting', 'Setting password…')
              : t('common.continue', 'Continue')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
