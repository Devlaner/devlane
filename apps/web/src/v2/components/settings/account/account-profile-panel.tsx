import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CameraIcon, ImageIcon, MailIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/v2/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/v2/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/v2/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/v2/components/ui/avatar';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/v2/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/v2/components/ui/field';
import { Input } from '@/v2/components/ui/input';
import { SettingsPanel, apiErrorMessage } from '@/v2/components/settings/settings-panel';
import { CoverImageModal } from '../../../../components/CoverImageModal';
import { UploadImageModal } from '../../../../components/UploadImageModal';
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
      toast.success(t('settings.account.emailChange.updated', 'Email address updated.'));
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
      toast.success(t('settings.account.profileSaved', 'Profile updated.'));
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
      <Card className="gap-0 overflow-hidden pt-0">
        <div className="relative">
          <div
            className="bg-muted h-32 w-full bg-cover bg-center sm:h-40"
            style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
            aria-hidden
          />
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-3 right-3 shadow-sm"
            onClick={() => setCoverModalOpen(true)}
          >
            <ImageIcon />
            {t('settings.cover.change', 'Change cover')}
          </Button>
        </div>

        <CardHeader className="-mt-10 grid-cols-[auto_1fr] items-end gap-x-4 gap-y-0">
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            className="focus-visible:ring-ring group relative row-span-2 rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label={t('settings.account.changeProfilePicture', 'Change profile picture')}
          >
            <Avatar className="ring-background size-20 ring-4">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <span
              className="bg-background text-muted-foreground group-hover:text-foreground absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border shadow-sm"
              aria-hidden
            >
              <CameraIcon className="size-3.5" />
            </span>
          </button>
          <CardTitle className="truncate pb-1 text-base">
            {[firstName, lastName].filter(Boolean).join(' ') || (user?.name ?? '')}
          </CardTitle>
          <CardDescription className="truncate">{profileEmail}</CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-first-name">
                  {t('settings.account.firstName', 'First name')}
                </FieldLabel>
                <Input
                  id="account-first-name"
                  value={firstName}
                  autoComplete="given-name"
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="account-last-name">
                  {t('settings.account.lastName', 'Last name')}
                </FieldLabel>
                <Input
                  id="account-last-name"
                  value={lastName}
                  autoComplete="family-name"
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="account-display-name">
                {t('settings.account.displayName', 'Display name')}
              </FieldLabel>
              <Input
                id="account-display-name"
                value={displayName}
                autoComplete="nickname"
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
          </FieldGroup>

          {saveError && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="mt-6 justify-end border-t pt-6">
          <Button disabled={saving} onClick={() => void saveProfile()}>
            {saving
              ? t('common.saving', 'Saving…')
              : t('settings.account.saveChanges', 'Save changes')}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.account.email', 'Email')}</CardTitle>
          <CardDescription>
            {t(
              'settings.account.emailDescription',
              'Used to sign in and to reach you. A new address has to be confirmed before it takes effect.',
            )}
          </CardDescription>
          {emailStep === 'idle' && (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmailError(null);
                  setEmailNew('');
                  setEmailStep('request');
                }}
              >
                {t('common.change', 'Change')}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="account-email">{t('settings.account.email', 'Email')}</FieldLabel>
            <div className="relative">
              <MailIcon
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id="account-email"
                type="email"
                className="pl-9"
                value={profileEmail}
                readOnly
                disabled
              />
            </div>
          </Field>

          {emailStep === 'request' && (
            <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
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
                  size="sm"
                  disabled={emailBusy || !emailNew.trim()}
                  onClick={() => void requestEmailChange()}
                >
                  {emailBusy
                    ? t('settings.account.emailChange.sending', 'Sending…')
                    : t('settings.account.emailChange.sendCode', 'Send code')}
                </Button>
                <Button variant="outline" size="sm" onClick={resetEmailChange}>
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          )}

          {emailStep === 'verify' && (
            <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
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
                autoComplete="one-time-code"
                className="max-w-40 tracking-[0.3em]"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder={t('settings.account.emailChange.codePlaceholder', '6-digit code')}
                aria-label={t('settings.account.emailChange.code', 'Confirmation code')}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={emailBusy || !emailCode.trim()}
                  onClick={() => void verifyEmailChange()}
                >
                  {emailBusy
                    ? t('settings.account.emailChange.confirming', 'Confirming…')
                    : t('settings.account.emailChange.confirmEmail', 'Confirm email')}
                </Button>
                <Button variant="outline" size="sm" onClick={resetEmailChange}>
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          )}

          {emailError && (
            <Alert variant="destructive">
              <AlertDescription>{emailError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
            className="text-destructive hover:text-destructive border-destructive/40"
            disabled={deactivateBusy}
            onClick={() => setDeactivateOpen(true)}
          >
            {deactivateBusy
              ? t('settings.account.deactivate.busy', 'Deactivating…')
              : t('settings.account.deactivate.title', 'Deactivate account')}
          </Button>
          {deactivateError && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{deactivateError}</AlertDescription>
            </Alert>
          )}
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
