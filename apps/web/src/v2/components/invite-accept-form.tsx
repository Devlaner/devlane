import { Trans, useTranslation } from 'react-i18next';
import { Check, ChevronRight, Globe, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/v2/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/v2/components/ui/field';
import { Input } from '@/v2/components/ui/input';

export interface InviteAcceptFormProps {
  className?: string;
  step: 'invite' | 'join';
  workspaceName: string;
  joinEmail: string;
  onJoinEmailChange: (value: string) => void;
  onAccept: () => void;
  onIgnore: () => void;
  onContinue: () => void;
  onSignIn: () => void;
  isBusy?: boolean;
  error?: string;
}

export function InviteAcceptForm({
  className,
  step,
  workspaceName,
  joinEmail,
  onJoinEmailChange,
  onAccept,
  onIgnore,
  onContinue,
  onSignIn,
  isBusy = false,
  error,
}: InviteAcceptFormProps) {
  const { t } = useTranslation();

  if (step === 'join') {
    return (
      <div className={cn('flex flex-col gap-6', className)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
              <span className="text-muted-foreground">{t('common.join', 'Join')}</span>
              <Globe className="size-5 shrink-0" />
              <span>{workspaceName}</span>
            </h1>
            <p className="text-muted-foreground text-sm text-balance">
              {t('auth.inviteAccept.joinSubtitle', 'Log in to start managing work with your team.')}
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="join-email">{t('common.email', 'Email')}</FieldLabel>
            <div className="relative">
              <Input
                id="join-email"
                type="email"
                value={joinEmail}
                onChange={(e) => onJoinEmailChange(e.target.value)}
                placeholder={t('common.emailPlaceholder', 'you@example.com')}
                autoComplete="email"
                className="pr-9"
              />
              {joinEmail && (
                <button
                  type="button"
                  onClick={() => onJoinEmailChange('')}
                  aria-label={t('auth.inviteAccept.clearEmail', 'Clear email')}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </Field>

          {error && (
            <Field>
              <FieldError>{error}</FieldError>
            </Field>
          )}

          <Field>
            <Button type="button" onClick={onContinue}>
              {t('common.continue', 'Continue')}
            </Button>
            <FieldDescription className="text-center">
              {t('auth.inviteAccept.haveAccount', 'Already have an account?')}{' '}
              <button type="button" onClick={onSignIn} className="underline underline-offset-4">
                {t('common.signIn', 'Sign in')}
              </button>
            </FieldDescription>
          </Field>

          {/* Positional Trans indices (<2>, <6>) come from the stored translation
              string — copied verbatim from v1's InviteAcceptPage. Reformatting
              this block or converting the anchors shifts the indices and breaks
              the interpolation in every locale. */}
          <p className="text-muted-foreground text-center text-xs">
            <Trans i18nKey="auth.inviteAccept.legal">
              By signing in, you understand and agree to our{' '}
              <a href="/terms" className="underline hover:text-foreground">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </a>
              .
            </Trans>
          </p>
        </FieldGroup>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">
            {t('auth.inviteAccept.invitedTitle', 'You have been invited to {{workspaceName}}', {
              workspaceName,
            })}
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t(
              'auth.inviteAccept.description',
              "Your workspace is where you'll create projects, collaborate on work items, and organize different streams of work in your Devlane account.",
            )}
          </p>
        </div>

        {error && (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onAccept}
            disabled={isBusy}
            className="border-border bg-card hover:bg-accent flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium disabled:opacity-50"
          >
            <span className="flex items-center gap-3">
              <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                <Check className="size-5" />
              </span>
              {t('auth.inviteAccept.accept', 'Accept')}
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </button>

          <button
            type="button"
            onClick={onIgnore}
            disabled={isBusy}
            className="border-border bg-card hover:bg-accent flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium disabled:opacity-50"
          >
            <span className="flex items-center gap-3">
              <span className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                <X className="size-5" />
              </span>
              {t('auth.inviteAccept.ignore', 'Ignore')}
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </button>
        </div>
      </FieldGroup>
    </div>
  );
}
