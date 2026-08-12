import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { SignUpForm, isPasswordStrong, type SignUpStep } from '@/components/shadcn/signup-form';
import { PrismGradient } from '@/components/shadcn/ui/prism-gradient';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { API_BASE, getApiErrorMessage } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function SignUpPageV2() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setUserFromApi } = useAuth();

  const state = location.state as {
    from?: { pathname?: string; search?: string };
    email?: string;
    inviteToken?: string;
  } | null;
  const from = state?.from;
  const returnPath = from ? (from.pathname ?? '/') + (from.search ?? '') : '/';
  const prefilledEmail = state?.email ?? '';

  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');
  const inviteToken = useMemo(() => {
    const q = searchParams.get('invite')?.trim() ?? '';
    const st = state?.inviteToken?.trim() ?? '';
    return q || st;
  }, [searchParams, state?.inviteToken]);

  const [step, setStep] = useState<SignUpStep>('email');
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [magicCode, setMagicCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowSignup, setAllowSignup] = useState(true);
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);
  const [isPasswordEnabled, setIsPasswordEnabled] = useState(true);
  const [isMagicCodeEnabled, setIsMagicCodeEnabled] = useState(true);
  const [oauthProviders, setOauthProviders] = useState({
    google: false,
    github: false,
    gitlab: false,
  });

  useDocumentTitle(t('auth.signUp.documentTitle', 'Sign up'));

  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
    }
  }, [oauthError]);

  useEffect(() => {
    authService
      .getAuthConfig()
      .then((cfg) => {
        setAllowSignup(cfg.enable_signup);
        setIsSmtpConfigured(cfg.is_smtp_configured);
        setIsPasswordEnabled(cfg.is_email_password_enabled);
        setIsMagicCodeEnabled(cfg.is_magic_code_enabled ?? true);
        setOauthProviders({
          google: cfg.is_google_enabled,
          github: cfg.is_github_enabled,
          gitlab: cfg.is_gitlab_enabled,
        });
      })
      .catch(() => {});
  }, []);

  const canUseMagicCode = isMagicCodeEnabled && isSmtpConfigured && (allowSignup || !!inviteToken);

  const handleOAuth = useCallback(
    (provider: string) => {
      const nextPath = returnPath !== '/' ? `?next_path=${encodeURIComponent(returnPath)}` : '';
      window.location.assign(`${API_BASE}/auth/${provider}/${nextPath}`);
    },
    [returnPath],
  );

  const sendMagicCode = useCallback(async () => {
    await authService.requestMagicCode({
      email,
      ...(inviteToken ? { invite_token: inviteToken } : {}),
    });
  }, [email, inviteToken]);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);
      try {
        const resp = await authService.emailCheck(email);
        if (resp.existing) {
          navigate('/login-v2', { state: { email }, replace: true });
          return;
        }
        if (!resp.allow_public_signup && !inviteToken) {
          setError(t('auth.signUp.inviteOnly', 'Sign-up is by invite only.'));
          setIsSubmitting(false);
          return;
        }

        const magicOnly = !isPasswordEnabled && isMagicCodeEnabled && isSmtpConfigured;
        if (magicOnly) {
          try {
            await sendMagicCode();
            setStep('code');
          } catch (err: unknown) {
            setError(
              getApiErrorMessage(err) ||
                t('auth.signUp.sendCodeError', 'Could not send sign-up code.'),
            );
          } finally {
            setIsSubmitting(false);
          }
          return;
        }

        setStep('password');
      } catch {
        setStep('password');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      email,
      inviteToken,
      isPasswordEnabled,
      isMagicCodeEnabled,
      isSmtpConfigured,
      sendMagicCode,
      navigate,
      t,
    ],
  );

  const switchToMagicCode = useCallback(async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await sendMagicCode();
      setStep('code');
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err) || t('auth.signUp.sendCodeError', 'Could not send sign-up code.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [sendMagicCode, t]);

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!isPasswordStrong(password)) {
        setError(t('auth.password.strengthError', 'Password does not meet strength requirements.'));
        return;
      }
      if (password !== confirmPassword) {
        setError(t('auth.password.mismatch', 'Passwords do not match.'));
        return;
      }

      setIsSubmitting(true);
      try {
        const user = await authService.signUp({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        });
        setUserFromApi(user);
        navigate(returnPath, { replace: true });
      } catch (err: unknown) {
        setError(
          getApiErrorMessage(err) ||
            t('common.genericError', 'Something went wrong. Please try again.'),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      inviteToken,
      setUserFromApi,
      navigate,
      returnPath,
      t,
    ],
  );

  const handleMagicCodeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const code = magicCode.replace(/\D/g, '');
      if (code.length !== 6) {
        setError(t('auth.signUp.codeLengthError', 'Enter the 6-digit code from your email.'));
        return;
      }
      setIsSubmitting(true);
      try {
        const user = await authService.verifyMagicCode({
          email,
          code,
          first_name: firstName,
          last_name: lastName,
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        });
        setUserFromApi(user);
        navigate(returnPath, { replace: true });
      } catch (err: unknown) {
        setError(
          getApiErrorMessage(err) || t('auth.signUp.invalidCode', 'Invalid or expired code.'),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [magicCode, email, firstName, lastName, inviteToken, setUserFromApi, navigate, returnPath, t],
  );

  const goBackToEmail = useCallback(() => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setMagicCode('');
    setError('');
  }, []);

  const goBackToPassword = useCallback(() => {
    setStep('password');
    setMagicCode('');
    setError('');
  }, []);

  return (
    <div className="shadcn-reference relative min-h-svh overflow-hidden">
      {/* The gradient backs the whole page rather than one column, so both the
          copy and the form sit over it. */}
      <PrismGradient noise={{ opacity: 0.18, scale: 0.8 }} />
      {/* The gradient runs light in places, which would swallow the white text
          on top of it. This scrim darkens the page just enough to keep both
          columns legible without hiding the animation behind it. */}
      <div
        className="absolute inset-0 z-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(90deg, hsl(0 0% 0% / 0.55) 0%, hsl(0 0% 0% / 0.4) 55%, hsl(0 0% 0% / 0.45) 100%)',
        }}
      />

      <div className="relative z-10 grid min-h-svh lg:grid-cols-[48fr_52fr]">
        {/* Copy column. Hidden below lg, where the form takes the full width. */}
        <div className="hidden flex-col justify-between p-10 lg:flex">
          <Link to="/" className="flex w-fit items-center gap-2.5">
            <img src="/devlane-2-dark-no-bg.png" alt="" className="size-7 object-contain" />
            <span className="text-lg font-semibold text-white">Devlane</span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-5xl leading-[0.95] tracking-tighter text-white">
              <span className="block font-serif font-light italic">
                {t('auth.signUp.heroTitle1', 'Plan the work.')}
              </span>
              <span className="block font-bold">
                {t('auth.signUp.heroTitle2', 'Ship the product.')}
              </span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              {t(
                'auth.signUp.heroDescription',
                'Issue tracking and project management for development teams. Organise work into projects, cycles, and modules, and keep everyone on the same page.',
              )}
            </p>
          </div>

          <p className="text-xs text-white/60">
            {t('auth.copyright', '© {{year}} Devlane. All rights reserved.', {
              year: new Date().getFullYear(),
            })}
          </p>
        </div>

        <div className="flex items-center justify-center p-6 md:p-10">
          {/* No card: the form sits straight on the gradient. It still needs
              the on-glass palette, since the backdrop is dark in every theme
              and the default near-black text would drop out against it. */}
          <div className="shadcn-reference-on-glass w-full max-w-sm">
            {!allowSignup && !inviteToken ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  {t('auth.signUp.disabledTitle', 'Sign up is disabled')}
                </h1>
                <p className="text-muted-foreground text-sm text-balance">
                  {t(
                    'auth.signUp.disabledBody',
                    'Public sign-up is currently disabled. Please contact your administrator.',
                  )}
                </p>
                <Link to="/login-v2" className="mt-2 text-sm underline underline-offset-4">
                  {t('common.goToSignIn', 'Go to sign in')}
                </Link>
              </div>
            ) : (
              <SignUpForm
                step={step}
                email={email}
                onEmailChange={setEmail}
                firstName={firstName}
                onFirstNameChange={setFirstName}
                lastName={lastName}
                onLastNameChange={setLastName}
                password={password}
                onPasswordChange={setPassword}
                confirmPassword={confirmPassword}
                onConfirmPasswordChange={setConfirmPassword}
                magicCode={magicCode}
                onMagicCodeChange={setMagicCode}
                onEmailSubmit={handleEmailSubmit}
                onPasswordSubmit={handlePasswordSubmit}
                onMagicCodeSubmit={handleMagicCodeSubmit}
                onBackToEmail={goBackToEmail}
                onBackToPassword={goBackToPassword}
                onUseMagicCode={() => void switchToMagicCode()}
                onOAuth={handleOAuth}
                oauthProviders={oauthProviders}
                isSubmitting={isSubmitting}
                error={error}
                canUseMagicCode={canUseMagicCode}
                isPasswordEnabled={isPasswordEnabled}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
