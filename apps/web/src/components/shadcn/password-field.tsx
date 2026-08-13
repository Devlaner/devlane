import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/shadcn/ui/input';

/**
 * Password rule primitives shared by every v2 auth page that collects a
 * password: sign-up, reset, set, and invite sign-up. Kept in its own module
 * (rather than re-exported from signup-form.tsx) because these pages are
 * separate lazy route chunks — importing from signup-form.tsx would pull its
 * full three-step form and inline OAuth icons into chunks that never render
 * them.
 */

export interface PasswordCriteria {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

export function getPasswordCriteria(pw: string): PasswordCriteria {
  return {
    minLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasDigit: /\d/.test(pw),
    hasSpecial: /[!@#$%^&*()\-_+=[\]{}|;:'",.<>?/]/.test(pw),
  };
}

export function isPasswordStrong(pw: string): boolean {
  const c = getPasswordCriteria(pw);
  return c.minLength && c.hasUpper && c.hasLower && c.hasDigit && c.hasSpecial;
}

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { t } = useTranslation();
  const criteria = getPasswordCriteria(password);
  if (!password) return null;

  const items: [string, boolean][] = [
    [t('auth.password.min8', 'At least 8 characters'), criteria.minLength],
    [t('auth.password.upper', 'Uppercase letter'), criteria.hasUpper],
    [t('auth.password.lower', 'Lowercase letter'), criteria.hasLower],
    [t('auth.password.number', 'Number'), criteria.hasDigit],
    [t('auth.password.special', 'Special character'), criteria.hasSpecial],
  ];

  return (
    <div className="mt-1 space-y-1">
      {items.map(([label, met]) => (
        <div key={label} className="flex items-center gap-1.5 text-xs">
          {met ? (
            <CircleCheck className="size-3.5 text-green-500" />
          ) : (
            <CircleAlert className="text-muted-foreground size-3.5" />
          )}
          <span className={met ? 'text-green-500' : 'text-muted-foreground'}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Live match/mismatch line shown under a confirm-password field. */
export function PasswordMatchHint({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}) {
  const { t } = useTranslation();
  if (!confirmPassword) return null;

  if (password !== confirmPassword) {
    return (
      <p className="text-destructive text-xs">
        {t('common.passwordsDoNotMatchInline', 'Passwords do not match')}
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1 text-xs text-green-500">
      <CircleCheck className="size-3" />
      {t('common.passwordsMatch', 'Passwords match')}
    </p>
  );
}

/** Password input with a show/hide toggle, used for every password field. */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={
          visible
            ? t('common.hidePassword', 'Hide password')
            : t('common.showPassword', 'Show password')
        }
        aria-pressed={visible}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
