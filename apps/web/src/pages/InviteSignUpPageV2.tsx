import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { InviteSignUpForm } from '@/components/shadcn/invite-signup-form';
import { AuthPageShellV2 } from '@/components/shadcn/auth-page-shell-v2';
import { isPasswordStrong } from '@/components/shadcn/password-field';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { workspaceService } from '../services/workspaceService';
import { getApiErrorMessage } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function InviteSignUpPageV2() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setUserFromApi, user } = useAuth();

  const state = location.state as {
    email?: string;
    token?: string;
    workspaceName?: string;
    workspaceSlug?: string;
  } | null;

  const email = (state?.email ?? '').trim();
  const token = (state?.token ?? '').trim();
  const workspaceName = useMemo(
    () => state?.workspaceName ?? t('auth.inviteSignUp.defaultWorkspace', 'the workspace'),
    [state?.workspaceName, t],
  );
  const workspaceSlug = (state?.workspaceSlug ?? '').trim();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allMet = isPasswordStrong(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  useDocumentTitle(t('auth.inviteSignUp.documentTitle', 'Sign up'));

  useEffect(() => {
    if (!email || !token) {
      navigate('/', { replace: true });
    }
  }, [email, token, navigate]);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!allMet) {
      setError(t('auth.inviteSignUp.requirementsError', 'Please meet all password requirements.'));
      return;
    }
    if (!passwordsMatch) {
      setError(t('auth.password.mismatch', 'Passwords do not match.'));
      return;
    }
    setIsSubmitting(true);
    try {
      const apiUser = await authService.signUp({
        email,
        password,
        invite_token: token,
      });
      setUserFromApi(apiUser);
      await workspaceService.joinByToken(token);
      navigate(`/${workspaceSlug}`, { replace: true });
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err) ||
          t('common.genericError', 'Something went wrong. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSignIn = () => {
    navigate('/login-v2', {
      replace: true,
      state: {
        // See InviteAcceptPageV2: routes back through the v2 invite page so
        // the post-login auto-accept happens in v2 chrome, not v1's.
        from: { pathname: '/invite-v2', search: `?token=${token}` },
        email,
      },
    });
  };

  if (!email || !token) {
    return (
      <AuthPageShellV2>
        <p className="text-muted-foreground text-center text-sm">
          {t('common.loading', 'Loading…')}
        </p>
      </AuthPageShellV2>
    );
  }

  return (
    <AuthPageShellV2>
      <InviteSignUpForm
        workspaceName={workspaceName}
        email={email}
        password={password}
        onPasswordChange={setPassword}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
        isDisabled={isSubmitting || !allMet || !passwordsMatch}
        onSignIn={handleSignIn}
      />
    </AuthPageShellV2>
  );
}
