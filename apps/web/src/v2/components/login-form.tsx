import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/v2/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/v2/components/ui/field';
import { Input } from '@/v2/components/ui/input';

type LoginFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  error?: string;
  canResetPassword?: boolean;
};

export function LoginForm({
  className,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onSubmit,
  isSubmitting = false,
  error,
  canResetPassword = false,
  ...props
}: LoginFormProps) {
  const { t } = useTranslation();

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t('auth.login.titlePassword', 'Welcome back!')}</h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t('auth.login.subtitlePassword', 'Enter your password to sign in.')}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="email">{t('auth.login.emailLabel', 'Email')}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth.login.emailPlaceholder', 'name@company.com')}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
          />
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">{t('auth.login.passwordLabel', 'Password')}</FieldLabel>
            {canResetPassword && (
              <Link
                to="/forgot-password-v2"
                className="ml-auto text-sm underline-offset-4 hover:underline"
              >
                {t('auth.login.forgotPassword', 'Forgot your password?')}
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('auth.login.passwordPlaceholder', 'Enter password')}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
          />
        </Field>

        {error && (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t('auth.login.signingIn', 'Signing in…')
              : t('auth.login.signIn', 'Sign in')}
          </Button>
          <FieldDescription className="text-center">
            {t('auth.login.noAccount', "Don't have an account? ")}
            <Link to="/sign-up-v2" className="underline underline-offset-4">
              {t('common.createAccount', 'Create account')}
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
