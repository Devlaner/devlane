import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/v2/components/ui/alert';
import { Button } from '@/v2/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/v2/components/ui/card';
import { Field, FieldLabel } from '@/v2/components/ui/field';
import { SettingsPanel, apiErrorMessage } from '@/v2/components/settings/settings-panel';
import {
  PasswordInput,
  PasswordMatchHint,
  PasswordStrengthIndicator,
} from '@/v2/components/password-field';
import { userService } from '../../../../services/userService';

/** Password change. */
export function AccountSecurityPanel() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (newPassword.length < 8) {
      setError(
        t('settings.security.passwordTooShort', 'New password must be at least 8 characters'),
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(
        t('settings.security.passwordMismatch', 'New password and confirmation do not match'),
      );
      return;
    }
    setLoading(true);
    try {
      await userService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('settings.security.changed', 'Password changed.'));
    } catch (e) {
      setError(apiErrorMessage(e, t('settings.security.changeError', 'Failed to change password')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsPanel
      title={t('settings.security.title', 'Security')}
      description={t(
        'settings.security.description',
        'Use at least 8 characters. Changing your password does not sign you out of other sessions.',
      )}
    >
      <Card>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <CardHeader>
            <CardTitle className="text-base">
              {t('settings.security.changePassword', 'Change password')}
            </CardTitle>
            <CardDescription>
              {t(
                'settings.security.cardDescription',
                'Pick a password you do not use anywhere else.',
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex max-w-md flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="current-password">
                {t('settings.security.currentPassword', 'Current password')}
              </FieldLabel>
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder={t('settings.security.oldPasswordPlaceholder', 'Old password')}
                autoComplete="current-password"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="new-password">
                {t('settings.security.newPassword', 'New password')}
              </FieldLabel>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder={t('settings.security.newPasswordPlaceholder', 'Enter new password')}
                autoComplete="new-password"
              />
              <PasswordStrengthIndicator password={newPassword} />
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm-password">
                {t('settings.security.confirmPassword', 'Confirm password')}
              </FieldLabel>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={t('settings.security.confirmPasswordPlaceholder', 'Confirm password')}
                autoComplete="new-password"
              />
              <PasswordMatchHint password={newPassword} confirmPassword={confirmPassword} />
            </Field>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="justify-end border-t">
            <Button
              type="submit"
              disabled={
                loading ||
                !currentPassword ||
                !newPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
            >
              {loading
                ? t('settings.security.changing', 'Changing…')
                : t('settings.security.changePassword', 'Change password')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </SettingsPanel>
  );
}
