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
  FieldSeparator,
} from '@/v2/components/ui/field';
import { Input } from '@/v2/components/ui/input';
import {
  PasswordInput,
  PasswordMatchHint,
  PasswordStrengthIndicator,
} from '@/v2/components/password-field';

export type SignUpStep = 'email' | 'password' | 'code';

export {
  type PasswordCriteria,
  getPasswordCriteria,
  isPasswordStrong,
} from '@/v2/components/password-field';

const OAUTH_ICONS: Record<string, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ),
  gitlab: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.386 9.452.044 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.625-8.443a.92.92 0 0 0 .33-1.024" />
    </svg>
  ),
};

export interface SignUpFormProps {
  className?: string;
  step: SignUpStep;

  email: string;
  onEmailChange: (value: string) => void;
  firstName: string;
  onFirstNameChange: (value: string) => void;
  lastName: string;
  onLastNameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  magicCode: string;
  onMagicCodeChange: (value: string) => void;

  onEmailSubmit: (e: React.FormEvent) => void;
  onPasswordSubmit: (e: React.FormEvent) => void;
  onMagicCodeSubmit: (e: React.FormEvent) => void;

  onBackToEmail: () => void;
  onBackToPassword: () => void;
  onUseMagicCode: () => void;

  onOAuth: (provider: string) => void;
  oauthProviders: { google: boolean; github: boolean; gitlab: boolean };

  isSubmitting?: boolean;
  error?: string;
  canUseMagicCode?: boolean;
  isPasswordEnabled?: boolean;
}

export function SignUpForm({
  className,
  step,
  email,
  onEmailChange,
  firstName,
  onFirstNameChange,
  lastName,
  onLastNameChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  magicCode,
  onMagicCodeChange,
  onEmailSubmit,
  onPasswordSubmit,
  onMagicCodeSubmit,
  onBackToEmail,
  onBackToPassword,
  onUseMagicCode,
  onOAuth,
  oauthProviders,
  isSubmitting = false,
  error,
  canUseMagicCode = false,
  isPasswordEnabled = true,
}: SignUpFormProps) {
  const { t } = useTranslation();

  const hasOAuth = oauthProviders.google || oauthProviders.github || oauthProviders.gitlab;

  const title =
    step === 'code'
      ? t('auth.signUp.titleCode', 'Verify your email')
      : t('auth.signUp.title', 'Create your account');
  const subtitle =
    step === 'email'
      ? t('auth.signUp.subtitleEmail', 'Enter your email to get started.')
      : step === 'code'
        ? t(
            'auth.signUp.subtitleCode',
            'We sent a 6-digit code to your inbox. It expires in 10 minutes.',
          )
        : t('auth.signUp.subtitlePassword', 'Set up your account to get started.');

  const header = (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground text-sm text-balance">{subtitle}</p>
    </div>
  );

  /* Shown on the password and code steps so the entered address stays visible
     and editable without losing the rest of the form. */
  const emailChip = (
    <button
      type="button"
      onClick={onBackToEmail}
      className="text-muted-foreground hover:text-foreground mx-auto flex items-center gap-1 text-xs"
    >
      <span aria-hidden>←</span>
      <span>{email}</span>
    </button>
  );

  const nameFields = (
    <div className="flex gap-3">
      <Field>
        <FieldLabel htmlFor="first-name">{t('common.firstName', 'First name')}</FieldLabel>
        <Input
          id="first-name"
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          autoComplete="given-name"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="last-name">{t('common.lastName', 'Last name')}</FieldLabel>
        <Input
          id="last-name"
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
          autoComplete="family-name"
        />
      </Field>
    </div>
  );

  const errorField = error ? (
    <Field>
      <FieldError>{error}</FieldError>
    </Field>
  ) : null;

  if (step === 'email') {
    return (
      <form className={cn('flex flex-col gap-6', className)} onSubmit={onEmailSubmit}>
        <FieldGroup>
          {header}

          {hasOAuth && (
            <>
              <Field>
                {/* Labels are spelled out per provider rather than built from
                    the provider id: i18next-parser only sees static keys. */}
                {oauthProviders.google && (
                  <Button variant="outline" type="button" onClick={() => onOAuth('google')}>
                    {OAUTH_ICONS.google}
                    {t('auth.signUp.signUpWithGoogle', 'Sign up with Google')}
                  </Button>
                )}
                {oauthProviders.github && (
                  <Button variant="outline" type="button" onClick={() => onOAuth('github')}>
                    {OAUTH_ICONS.github}
                    {t('auth.signUp.signUpWithGithub', 'Sign up with GitHub')}
                  </Button>
                )}
                {oauthProviders.gitlab && (
                  <Button variant="outline" type="button" onClick={() => onOAuth('gitlab')}>
                    {OAUTH_ICONS.gitlab}
                    {t('auth.signUp.signUpWithGitlab', 'Sign up with GitLab')}
                  </Button>
                )}
              </Field>
              <FieldSeparator>{t('common.or', 'or')}</FieldSeparator>
            </>
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
            />
          </Field>

          {errorField}

          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('common.checking', 'Checking…')
                : t('auth.signUp.continueWithEmail', 'Continue with email')}
            </Button>
            <FieldDescription className="text-center">
              {t('auth.signUp.haveAccount', 'Already have an account? ')}
              <Link to="/login-v2" className="underline underline-offset-4">
                {t('common.goToSignIn', 'Go to sign in')}
              </Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    );
  }

  if (step === 'password') {
    return (
      <form className={cn('flex flex-col gap-6', className)} onSubmit={onPasswordSubmit}>
        <FieldGroup>
          {header}
          {emailChip}
          {nameFields}

          <Field>
            <FieldLabel htmlFor="password">{t('common.password', 'Password')}</FieldLabel>
            <PasswordInput
              id="password"
              value={password}
              onChange={onPasswordChange}
              placeholder={t('auth.signUp.passwordPlaceholder', 'Enter password')}
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
              placeholder={t('auth.signUp.confirmPasswordPlaceholder', 'Re-enter password')}
              autoComplete="new-password"
            />
            <PasswordMatchHint password={password} confirmPassword={confirmPassword} />
          </Field>

          {errorField}

          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('common.creatingAccount', 'Creating account…')
                : t('common.createAccount', 'Create account')}
            </Button>
            {canUseMagicCode && isPasswordEnabled && (
              <FieldDescription className="text-center">
                <button
                  type="button"
                  onClick={onUseMagicCode}
                  disabled={isSubmitting}
                  className="underline underline-offset-4 disabled:opacity-50"
                >
                  {t('auth.signUp.useMagicCode', 'Sign up with email code instead')}
                </button>
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      </form>
    );
  }

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onMagicCodeSubmit}>
      <FieldGroup>
        {header}
        {emailChip}
        {nameFields}

        <Field>
          <FieldLabel htmlFor="magic-code">{t('auth.signUp.codeLabel', '6-digit code')}</FieldLabel>
          <Input
            id="magic-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={magicCode}
            onChange={(e) => onMagicCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            required
          />
        </Field>

        {errorField}

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.verifying', 'Verifying…') : t('common.continue', 'Continue')}
          </Button>
          <FieldDescription className="text-center">
            <button
              type="button"
              onClick={onUseMagicCode}
              disabled={isSubmitting}
              className="underline underline-offset-4 disabled:opacity-50"
            >
              {t('auth.signUp.resendCode', 'Resend code')}
            </button>
          </FieldDescription>
          {isPasswordEnabled && (
            <FieldDescription className="text-center">
              <button
                type="button"
                onClick={onBackToPassword}
                className="underline underline-offset-4"
              >
                {t('auth.signUp.usePassword', 'Use password instead')}
              </button>
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
}
