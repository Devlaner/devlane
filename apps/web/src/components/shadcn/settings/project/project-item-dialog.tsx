import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog';
import { Input } from '@/components/shadcn/ui/input';
import { Label } from '@/components/shadcn/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import { apiErrorMessage } from '@/components/shadcn/settings/settings-panel';

export interface ProjectItemValues {
  name: string;
  color: string;
  group: string;
}

interface ProjectItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  namePlaceholder: string;
  /** States carry a workflow group; labels do not. */
  withGroup?: boolean;
  /** Values to start from — an existing row when editing, defaults when adding. */
  initial: ProjectItemValues;
  editing: boolean;
  onSubmit: (values: ProjectItemValues) => Promise<void>;
}

/**
 * Add/edit form shared by project states and labels: both are a name, a colour,
 * and (for states) a workflow group.
 */
export function ProjectItemDialog({
  open,
  onOpenChange,
  title,
  namePlaceholder,
  withGroup = false,
  initial,
  editing,
  onSubmit,
}: ProjectItemDialogProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* The caller changes `initial` when it opens the dialog for a different row. */
  useEffect(() => {
    if (open) {
      setValues(initial);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open]);

  const submit = async () => {
    if (!values.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
      onOpenChange(false);
    } catch (e) {
      setError(
        apiErrorMessage(e, t('settings.itemDialog.saveError', 'Failed to save. Try again.')),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form
          id="project-item-v2-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="project-item-name">{t('common.name', 'Name')}</Label>
            <Input
              id="project-item-name"
              value={values.name}
              placeholder={namePlaceholder}
              autoFocus
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-item-color">{t('common.color', 'Color')}</Label>
            <div className="flex items-center gap-2">
              <input
                id="project-item-color"
                type="color"
                value={values.color}
                onChange={(e) => setValues((v) => ({ ...v, color: e.target.value }))}
                className="border-input h-9 w-14 cursor-pointer rounded-md border bg-transparent"
              />
              <Input
                value={values.color}
                onChange={(e) => setValues((v) => ({ ...v, color: e.target.value }))}
                aria-label={t('settings.itemDialog.colorHex', 'Colour hex value')}
              />
            </div>
          </div>

          {withGroup && (
            <div className="space-y-2">
              <Label htmlFor="project-item-group">{t('settings.states.group', 'Group')}</Label>
              <Select
                value={values.group}
                onValueChange={(group) => setValues((v) => ({ ...v, group }))}
              >
                <SelectTrigger id="project-item-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">
                    {t('settings.states.group.backlog', 'Backlog')}
                  </SelectItem>
                  <SelectItem value="unstarted">
                    {t('settings.states.group.unstarted', 'Unstarted')}
                  </SelectItem>
                  <SelectItem value="started">
                    {t('settings.states.group.started', 'Started')}
                  </SelectItem>
                  <SelectItem value="completed">
                    {t('settings.states.group.completed', 'Completed')}
                  </SelectItem>
                  <SelectItem value="cancelled">
                    {t('settings.states.group.cancelled', 'Cancelled')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            form="project-item-v2-form"
            disabled={saving || !values.name.trim()}
          >
            {saving
              ? t('common.saving', 'Saving…')
              : editing
                ? t('common.save', 'Save')
                : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
