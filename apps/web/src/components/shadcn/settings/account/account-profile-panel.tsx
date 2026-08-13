import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/shadcn/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/ui/card';
import { Input } from '@/components/shadcn/ui/input';
import { Label } from '@/components/shadcn/ui/label';
import { SettingsPanel, apiErrorMessage } from '@/components/shadcn/settings/settings-panel';
import { CoverImageModal } from '../../../CoverImageModal';
import { UploadImageModal } from '../../../UploadImageModal';
import { useAuth } from '../../../../contexts/AuthContext';
import { getImageUrl } from '../../../../lib/utils';
import { accountService } from '../../../../services/accountService';
import { authService } from '../../../../services/authService';
import { userService } from '../../../../services/userService';

/** Name, avatar, cover, the verified email-change flow, and deactivation. */
export function AccountProfilePanel() {
  const { t } = useTranslation();
  const { user, setUserFromApi, logout, refreshUser } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  /* Email-change flow: 'idle' (show Change), 'request' (enter new email),
     'verify' (enter the emailed code). */
  const [emailStep, setEmailStep] = useState<'idle' | 'request' | 'verify'>('idle');
  const [emailNew, setEmailNew] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  /* Bumped whenever the flow is reset/cancelled; in-flight requests captured an
     earlier value and bail out instead of resurrecting the panel. */
  const emailFlowToken = useRef(0);

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authService.getMe().then((api) => {
      if (cancelled || !api) return;
      setFirstName(api.first_name ?? '');
      setLastName(api.last_name ?? '');
      setDisplayName(api.display_name ?? '');
      setProfileEmail(api.email ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetEmailChange = () => {
    emailFlowToken.current += 1;
    setEmailStep('idle');
    setEmailNew('');
    setEmailCode('');
    setEmailError(null);
    setEmailBusy(false);
  };

  const requestEmailChange = async () => {
    const token = emailFlowToken.current;
    setEmailError(null);
    setEmailBusy(true);
    try {
      await accountService.requestEmailChange(emailNew.trim());
      if (emailFlowToken.current !== token) return;
      setEmailStep('verify');
    } catch (e) {
      if (emailFlowToken.current !== token) return;
      setEmailError(
        apiErrorMessage(
          e,
          t('settings.account.emailChange.sendError', 'Failed to send the confirmation code'),
        ),
      );
    } finally {
      if (emailFlowToken.current === token) setEmailBusy(false);
    }
  };

  const verifyEmailChange = async () => {
    const token = emailFlowToken.current;
    setEmailError(null);
    setEmailBusy(true);
    try {
      const updated = await accountService.verifyEmailChange(emailCode.trim());
      if (emailFlowToken.current !== token) return;
      setProfileEmail(updated);
      await refreshUser();
      if (emailFlowToken.current !== token) return;
      resetEmailChange();
    } catch (e) {
      if (emailFlowToken.current !== token) return;
      setEmailError(
        apiErrorMessage(
          e,
          t('settings.account.emailChange.confirmError', 'Failed to confirm the new email'),
        ),
      );
    } finally {
      if (emailFlowToken.current === token) setEmailBusy(false);
    }
  };

  const saveProfile = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const api = await userService.updateMe({
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
      });
      setUserFromApi(api);
    } catch (e) {
      setSaveError(
        apiErrorMessage(e, t('settings.account.profileSaveError', 'Failed to save profile')),
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivateAccount = async () => {
    setDeactivateError(null);
    setDeactivateBusy(true);
    try {
      await accountService.deactivate();
      await logout();
    } catch (e) {
      setDeactivateError(
        apiErrorMessage(
          e,
          t('settings.account.deactivate.error', 'Failed to deactivate account. Please try again.'),
        ),
      );
      setDeactivateBusy(false);
    }
  };

  const coverUrl = getImageUrl(user?.coverImageUrl);
  const avatarUrl = getImageUrl(user?.avatarUrl);
  const initials =
    (user?.name ?? '')
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  return (
    <SettingsPanel
      title={t('settings.account.profileTitle', 'Profile')}
      description={t(
        'settings.account.profileDescription',
        'How you appear to everyone else in Devlane.',
      )}
    >
      <div className="relative">
        <div
          className="bg-muted h-36 w-full overflow-hidden rounded-lg bg-cover bg-center"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
        />
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-2 bottom-2"
          onClick={() => setCoverModalOpen(true)}
        >
          {t('settings.cover.change', 'Change cover')}
        </Button>
        <div className="flex items-end gap-4 px-4">
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            className="focus-visible:ring-ring -mt-8 rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label={t('settings.account.changeProfilePicture', 'Change profile picture')}
          >
            <Avatar className="ring-background size-16 ring-4">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0 pb-1">
            <p className="truncate text-base font-semibold">
              {[firstName, lastName].filter(Boolean).join(' ') || (user?.name ?? '')}
            </p>
            <p className="text-muted-foreground truncate text-sm">{profileEmail}</p>
          </div>
        </div>
      </div>

      <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account-first-name">
            {t('settings.account.firstName', 'First name')}
          </Label>
          <Input
            id="account-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-last-name">{t('settings.account.lastName', 'Last name')}</Label>
          <Input
            id="account-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="account-display-name">
            {t('settings.account.displayName', 'Display name')}
          </Label>
          <Input
            id="account-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="account-email">{t('settings.account.email', 'Email')}</Label>
          <div className="flex items-center gap-2">
            <Input id="account-email" type="email" value={profileEmail} readOnly disabled />
            {emailStep === 'idle' && (
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  setEmailError(null);
                  setEmailNew('');
                  setEmailStep('request');
                }}
              >
                {t('common.change', 'Change')}
              </Button>
            )}
          </div>

          {emailStep === 'request' && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-muted-foreground text-sm">
                {t(
                  'settings.account.emailChange.requestPrompt',
                  "Enter your new email. We'll send a confirmation code to it.",
                )}
              </p>
              <Input
                type="email"
                value={emailNew}
                onChange={(e) => setEmailNew(e.target.value)}
                placeholder={t('settings.account.emailChange.newEmailPlaceholder', 'new@email.com')}
                aria-label={t('settings.account.emailChange.newEmail', 'New email')}
              />
              <div className="flex gap-2">
                <Button
                  disabled={emailBusy || !emailNew.trim()}
                  onClick={() => void requestEmailChange()}
                >
                  {emailBusy
                    ? t('settings.account.emailChange.sending', 'Sending…')
                    : t('settings.account.emailChange.sendCode', 'Send code')}
                </Button>
                <Button variant="outline" onClick={resetEmailChange}>
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          )}

          {emailStep === 'verify' && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-muted-foreground text-sm">
                <Trans
                  i18nKey="settings.account.emailChange.verifyPrompt"
                  defaults="Enter the code we sent to <b>{{email}}</b>."
                  values={{ email: emailNew.trim() }}
                  components={{ b: <span className="text-foreground font-medium" /> }}
                />
              </p>
              <Input
                inputMode="numeric"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder={t('settings.account.emailChange.codePlaceholder', '6-digit code')}
                aria-label={t('settings.account.emailChange.code', 'Confirmation code')}
              />
              <div className="flex gap-2">
                <Button
                  disabled={emailBusy || !emailCode.trim()}
                  onClick={() => void verifyEmailChange()}
                >
                  {emailBusy
                    ? t('settings.account.emailChange.confirming', 'Confirming…')
                    : t('settings.account.emailChange.confirmEmail', 'Confirm email')}
                </Button>
                <Button variant="outline" onClick={resetEmailChange}>
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          )}

          {emailError && <p className="text-destructive text-sm">{emailError}</p>}
        </div>
      </div>

      {saveError && <p className="text-destructive text-sm">{saveError}</p>}
      <div>
        <Button disabled={saving} onClick={() => void saveProfile()}>
          {saving
            ? t('common.saving', 'Saving…')
            : t('settings.account.saveChanges', 'Save changes')}
        </Button>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-base">
            {t('settings.account.deactivate.title', 'Deactivate account')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.account.deactivate.description',
              'This deactivates your account and signs you out everywhere. Reactivating it requires an administrator.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={deactivateBusy}
            onClick={() => setDeactivateOpen(true)}
          >
            {deactivateBusy
              ? t('settings.account.deactivate.busy', 'Deactivating…')
              : t('settings.account.deactivate.title', 'Deactivate account')}
          </Button>
          {deactivateError && <p className="text-destructive mt-2 text-sm">{deactivateError}</p>}
        </CardContent>
      </Card>

      <AlertDialog
        open={deactivateOpen}
        onOpenChange={(open) => {
          if (deactivateBusy) return;
          setDeactivateError(null);
          setDeactivateOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.account.deactivate.confirmTitle', 'Deactivate account?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'settings.account.deactivate.confirmBody',
                "You'll be signed out everywhere and won't be able to sign back in. Reactivating your account requires an administrator.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateBusy}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deactivateBusy}
              onClick={(e) => {
                e.preventDefault();
                void deactivateAccount();
              }}
            >
              {deactivateBusy
                ? t('settings.account.deactivate.busy', 'Deactivating…')
                : t('settings.account.deactivate.confirm', 'Deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CoverImageModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        onSelect={async (url) => {
          try {
            setUserFromApi(await userService.updateMe({ cover_image: url }));
          } catch {
            /* The modal surfaces upload failures itself. */
          }
        }}
        title={t('settings.account.selectCoverImage', 'Select cover image')}
      />
      <UploadImageModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        onSave={async (url) => {
          try {
            setUserFromApi(await userService.updateMe({ avatar: url }));
          } catch {
            /* The modal surfaces upload failures itself. */
          }
        }}
        title={t('settings.account.uploadProfilePicture', 'Upload profile picture')}
      />
    </SettingsPanel>
  );
}
