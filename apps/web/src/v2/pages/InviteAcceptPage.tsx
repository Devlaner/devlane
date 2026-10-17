import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InviteAcceptForm } from '@/v2/components/invite-accept-form';
import { AuthPageShellV2 } from '@/v2/components/auth-page-shell';
import { Button } from '@/v2/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { invitationService } from '../../services/invitationService';
import { workspaceService } from '../../services/workspaceService';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function InviteAcceptPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const token = searchParams.get('token') ?? '';

  const [invite, setInvite] = useState<{
    workspace_name: string;
    workspace_slug: string;
    email: string;
    invitation_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [ignoring, setIgnoring] = useState(false);
  const [step, setStep] = useState<'invite' | 'join'>('invite');
  const [joinEmail, setJoinEmail] = useState('');
  const autoAcceptDone = useRef(false);

  useDocumentTitle(t('auth.inviteAccept.documentTitle', 'Accept invite'));

  useEffect(() => {
    if (!token.trim()) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    invitationService
      .getByToken(token)
      .then((data) => {
        if (!cancelled) setInvite(data);
      })
      .catch(() => {
        if (!cancelled) setError(t('auth.inviteAccept.notFound', 'Invite not found or expired.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate, t]);

  const doJoinWorkspace = useCallback(async () => {
    if (!token || !invite) return;
    setAccepting(true);
    try {
      await workspaceService.joinByToken(token);
      navigate(`/${invite.workspace_slug}`, { replace: true });
    } catch {
      setError(t('auth.inviteAccept.joinFailed', 'Failed to join workspace. Please try again.'));
    } finally {
      setAccepting(false);
    }
  }, [token, invite, navigate, t]);

  // When user returns from login (already authenticated), auto-accept and go to workspace
  useEffect(() => {
    if (!user || !invite || !token || step !== 'invite' || autoAcceptDone.current) return;
    autoAcceptDone.current = true;
    doJoinWorkspace();
  }, [user, invite, token, step, doJoinWorkspace]);

  const handleAccept = () => {
    if (!token || !invite) return;
    if (!user) {
      setJoinEmail(invite.email);
      setStep('join');
      return;
    }
    doJoinWorkspace();
  };

  const handleIgnore = async () => {
    if (!token) return;
    setIgnoring(true);
    try {
      await invitationService.declineByToken(token);
      navigate('/', { replace: true });
    } catch {
      setError(t('auth.inviteAccept.declineFailed', 'Failed to decline. Please try again.'));
    } finally {
      setIgnoring(false);
    }
  };

  const handleContinue = () => {
    if (!invite) return;
    navigate('/invite-v2/sign-up', {
      replace: true,
      state: {
        email: joinEmail,
        token,
        workspaceName: invite.workspace_name,
        workspaceSlug: invite.workspace_slug,
      },
    });
  };

  const handleSignIn = () => {
    navigate('/login-v2', {
      replace: true,
      state: {
        // Deliberate deviation from v1, which sends 'pathname: /invite': this
        // keeps the user on the v2 invite page after signing in, so the
        // auto-accept effect above fires on this page instead of dropping
        // back to v1 chrome.
        from: { pathname: '/invite-v2', search: `?token=${token}` },
        email: joinEmail,
      },
    });
  };

  if (authLoading || loading) {
    return (
      <AuthPageShellV2>
        <p className="text-muted-foreground text-center text-sm">
          {t('common.loading', 'Loading…')}
        </p>
      </AuthPageShellV2>
    );
  }

  if (error && !invite) {
    return (
      <AuthPageShellV2>
        <div className="text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/', { replace: true })}
          >
            {t('common.goHome', 'Go home')}
          </Button>
        </div>
      </AuthPageShellV2>
    );
  }

  if (!invite) return null;

  return (
    <AuthPageShellV2>
      <InviteAcceptForm
        step={step}
        workspaceName={invite.workspace_name}
        joinEmail={joinEmail}
        onJoinEmailChange={setJoinEmail}
        onAccept={handleAccept}
        onIgnore={() => void handleIgnore()}
        onContinue={handleContinue}
        onSignIn={handleSignIn}
        isBusy={accepting || ignoring}
        error={error ?? undefined}
      />
    </AuthPageShellV2>
  );
}
