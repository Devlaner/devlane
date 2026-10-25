import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface AuthPageShellProps {
  mode: 'sign-in' | 'sign-up';
  enableSignup?: boolean;
  children: React.ReactNode;
}

export function AuthPageShell({ mode, enableSignup = true, children }: AuthPageShellProps) {
  const { t } = useTranslation();
  const action =
    mode === 'sign-in' ? t('auth.signingIn', 'signing in') : t('auth.signingUp', 'signing up');
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto bg-(--bg-canvas) px-8 pt-6 pb-10">
      <div className="sticky top-0 flex w-full flex-shrink-0 items-center justify-between gap-6">
        <Link to="/" className="text-xl font-bold text-(--txt-primary)">
          Devlane
        </Link>
        {enableSignup && (
          <div className="flex items-center gap-2 text-sm text-(--txt-secondary)">
            <span>{mode === 'sign-in' ? 'New to Devlane?' : 'Already have an account?'}</span>
            <Link
              to={mode === 'sign-in' ? '/sign-up' : '/login'}
              className="font-semibold text-(--txt-accent) hover:underline"
            >
              {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
            </Link>
          </div>
        )}
      </div>
      <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
        {children}
      </div>
      <p className="mt-6 text-center text-xs text-(--txt-tertiary)">
        <Trans
          i18nKey="auth.termsNotice"
          defaults="By {{action}}, you agree to our terms of service and privacy policy."
          values={{ action }}
        />
      </p>
    </div>
  );
}
