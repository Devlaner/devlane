import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/shadcn/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/shadcn/ui/field';
import { Input } from '@/components/shadcn/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import { ORGANIZATION_SIZE_OPTIONS } from '@/constants/workspace';

type CreateWorkspaceFormProps = Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  name: string;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  slug: string;
  onSlugChange: (value: string) => void;
  organizationSize: string;
  onOrganizationSizeChange: (value: string) => void;
  baseUrl: string;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  error?: string;
};

// Radix Select rejects an empty-string item value, so the "no range chosen"
// option is dropped from the list; its label becomes the trigger placeholder
// and organizationSize === '' represents that unset state instead.
const SIZE_OPTIONS = ORGANIZATION_SIZE_OPTIONS.filter((opt) => opt.value !== '');

export function CreateWorkspaceForm({
  className,
  name,
  onNameChange,
  slug,
  onSlugChange,
  organizationSize,
  onOrganizationSizeChange,
  baseUrl,
  onSubmit,
  isSubmitting = false,
  error,
  ...props
}: CreateWorkspaceFormProps) {
  const { t } = useTranslation();

  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">
            {t('workspace.create.title', 'Create your workspace')}
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {t(
              'workspace.create.subtitle',
              'Workspaces are shared environments where teams manage their projects.',
            )}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="workspace-name">
            {t('workspace.create.nameLabel', 'Name your workspace')}
          </FieldLabel>
          <Input
            id="workspace-name"
            value={name}
            onChange={onNameChange}
            placeholder={t(
              'workspace.create.namePlaceholder',
              'Something familiar and recognizable is always best.',
            )}
            autoComplete="organization"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="workspace-url">
            {t('workspace.create.urlLabel', "Set your workspace's URL")}
          </FieldLabel>
          {/* No input-group primitive in components/shadcn/ui — built inline.
              The nested Input picks up the on-glass background rule too, which
              reads fine layered inside this border. */}
          <div className="border-input flex items-center overflow-hidden rounded-md border">
            <span className="bg-muted text-muted-foreground shrink-0 truncate px-3 py-2 text-sm">
              {baseUrl}
            </span>
            <Input
              id="workspace-url"
              value={slug}
              onChange={(e) =>
                onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder={t('workspace.create.urlPlaceholder', 'workspace-name')}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="organization-size">
            {t('workspace.create.orgSizeLabel', 'How many people will use this workspace?')}
          </FieldLabel>
          <Select value={organizationSize} onValueChange={onOrganizationSizeChange}>
            <SelectTrigger id="organization-size" className="w-full">
              <SelectValue placeholder={t('workspace.orgSize.selectRange', 'Select a range')} />
            </SelectTrigger>
            <SelectContent className="shadcn-reference-on-glass">
              {SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {error && (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t('workspace.create.submitting', 'Creating…')
              : t('workspace.create.submit', 'Create workspace')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
