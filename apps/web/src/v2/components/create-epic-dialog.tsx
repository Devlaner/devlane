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
import { epicService } from '../../services/epicService';
import { PRIORITIES, PRIORITY_LABELS, type Priority } from '../lib/project';
import type { IssueApiResponse } from '../../api/types';

interface CreateEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  projectId: string;
  onCreated: (epic: IssueApiResponse) => void;
}

/**
 * Creates an epic from the epics list. The shipped page opens an inline card
 * with a bare name field; this asks for the two things that are otherwise a
 * second trip to the detail page — a description and a priority — and leaves
 * state, dates and children to that page.
 */
export function CreateEpicDialog({
  open,
  onOpenChange,
  workspaceSlug,
  projectId,
  onCreated,
}: CreateEpicDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reopening starts from a blank form rather than the last attempt's text. */
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setPriority('none');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await epicService.create(workspaceSlug, projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
        priority,
      });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('epics.createFailed', 'Failed to create epic.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('epics.newEpic', 'New epic')}</DialogTitle>
          <DialogDescription>
            {t(
              'epics.createDescription',
              'An epic groups related work items so a long-running effort can be tracked as one thing.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form id="create-epic-v2-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-epic-name">{t('common.name', 'Name')}</Label>
            <Input
              id="create-epic-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('epics.namePlaceholder', 'Epic name')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-epic-description">
              {t('common.description', 'Description')}
            </Label>
            <Textarea
              id="create-epic-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('epics.descriptionPlaceholder', 'Optional description')}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-epic-priority">{t('views.priority', 'Priority')}</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
              <SelectTrigger id="create-epic-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`priority.${value}`, PRIORITY_LABELS[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button type="submit" form="create-epic-v2-form" disabled={submitting || !name.trim()}>
            {submitting ? t('common.creating', 'Creating…') : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
