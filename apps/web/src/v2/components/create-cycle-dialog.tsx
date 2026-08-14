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
import { Textarea } from '@/v2/components/ui/textarea';
import { cycleService } from '../../services/cycleService';
import type { CycleApiResponse } from '../../api/types';

interface CreateCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  projectId: string;
  onCreated: (cycle: CycleApiResponse) => void;
}

/**
 * Creates a cycle from the cycles list. A cycle is a date window first and a
 * name second, so both dates are asked for here — a cycle without them lands in
 * the draft group and is invisible on the timeline.
 */
export function CreateCycleDialog({
  open,
  onOpenChange,
  workspaceSlug,
  projectId,
  onCreated,
}: CreateCycleDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reopening starts from a blank form rather than the last attempt's text. */
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (startDate && endDate && endDate < startDate) {
      setError(t('cycles.dateRangeInvalid', 'The end date cannot fall before the start date.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await cycleService.create(workspaceSlug, projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('cycles.createFailed', 'Failed to create cycle.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('cycles.newCycle', 'New cycle')}</DialogTitle>
          <DialogDescription>
            {t(
              'cycles.createDescription',
              'A cycle is a time-boxed delivery window that work items are pulled into.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form id="create-cycle-v2-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-cycle-name">{t('common.name', 'Name')}</Label>
            <Input
              id="create-cycle-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('cycles.namePlaceholder', 'Cycle name')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-cycle-description">
              {t('common.description', 'Description')}
            </Label>
            <Textarea
              id="create-cycle-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('cycles.descriptionPlaceholder', 'Optional description')}
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-cycle-start">{t('cycles.startDate', 'Start date')}</Label>
              <Input
                id="create-cycle-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-cycle-end">{t('cycles.endDate', 'End date')}</Label>
              <Input
                id="create-cycle-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
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
          <Button type="submit" form="create-cycle-v2-form" disabled={submitting || !name.trim()}>
            {submitting ? t('common.creating', 'Creating…') : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
