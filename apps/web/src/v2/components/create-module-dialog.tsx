import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Textarea } from '@/v2/components/ui/textarea';
import { moduleService } from '../../services/moduleService';
import { MODULE_STATUSES } from '../../lib/moduleStatuses';
import type { ModuleApiResponse } from '../../api/types';

interface CreateModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  projectId: string;
  onCreated: (module: ModuleApiResponse) => void;
}

/**
 * Creates a module from the modules list, asking for the fields the list itself
 * shows — status and the date window — so a new row is complete the moment it
 * appears rather than reading as an empty stub.
 */
export function CreateModuleDialog({
  open,
  onOpenChange,
  workspaceSlug,
  projectId,
  onCreated,
}: CreateModuleDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('backlog');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reopening starts from a blank form rather than the last attempt's text. */
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setStatus('backlog');
      setStartDate('');
      setTargetDate('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (startDate && targetDate && targetDate < startDate) {
      setError(t('modules.dateRangeInvalid', 'The target date cannot fall before the start date.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await moduleService.create(workspaceSlug, projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        start_date: startDate || undefined,
        target_date: targetDate || undefined,
      });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('modules.createFailed', 'Failed to create module.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('modules.newModule', 'New module')}</DialogTitle>
          <DialogDescription>
            {t(
              'modules.createDescription',
              'A module splits the project into a body of work that is planned and tracked on its own.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form id="create-module-v2-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-module-name">{t('common.name', 'Name')}</Label>
            <Input
              id="create-module-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('modules.namePlaceholder', 'Module name')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-module-description">
              {t('common.description', 'Description')}
            </Label>
            <Textarea
              id="create-module-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('modules.descriptionPlaceholder', 'Optional description')}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-module-status">{t('common.status', 'Status')}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="create-module-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULE_STATUSES.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {t(`moduleStatus.${option.id}`, option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-module-start">{t('modules.startDate', 'Start')}</Label>
              <Input
                id="create-module-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-module-target">{t('modules.targetDate', 'Target')}</Label>
              <Input
                id="create-module-target"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" form="create-module-v2-form" disabled={submitting || !name.trim()}>
            {submitting ? t('common.creating', 'Creating…') : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
