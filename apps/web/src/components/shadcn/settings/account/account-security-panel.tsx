import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { Button } from '@/components/shadcn/ui/button';
import { Input } from '@/components/shadcn/ui/input';
import { Label } from '@/components/shadcn/ui/label';
import { SettingsPanel, apiErrorMessage } from '@/components/shadcn/settings/settings-panel';
import { userService } from '../../../../services/userService';

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

function PasswordField({ id, label, placeholder, value, onChange }: PasswordFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          className="pr-9"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          aria-label={
            visible
              ? t('settings.security.hidePassword', 'Hide password')
              : t('settings.security.showPassword', 'Show password')
          }
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/** Password change. */
export function AccountSecurityPanel() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    setDone(false);
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
      setDone(true);
    } catch (e) {
      setError(apiErrorMessage(e, t('settings.security.changeError', 'Failed to change password')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsPanel
      title={t('settings.security.changePassword', 'Change password')}
      description={t(
        'settings.security.description',
        'Use at least 8 characters. Changing your password does not sign you out of other sessions.',
      )}
    >
      <form
        className="flex max-w-md flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <PasswordField
          id="current-password"
          label={t('settings.security.currentPassword', 'Current password')}
          placeholder={t('settings.security.oldPasswordPlaceholder', 'Old password')}
          value={currentPassword}
          onChange={setCurrentPassword}
        />
        <PasswordField
          id="new-password"
          label={t('settings.security.newPassword', 'New password')}
          placeholder={t('settings.security.newPasswordPlaceholder', 'Enter new password')}
          value={newPassword}
          onChange={setNewPassword}
        />
        <PasswordField
          id="confirm-password"
          label={t('settings.security.confirmPassword', 'Confirm password')}
          placeholder={t('settings.security.confirmPasswordPlaceholder', 'Confirm password')}
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        {done && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {t('settings.security.changed', 'Password changed.')}
          </p>
        )}
        <div>
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
        </div>
      </form>
    </SettingsPanel>
  );
}
