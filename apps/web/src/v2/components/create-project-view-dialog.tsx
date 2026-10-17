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
import { viewService } from '../../services/viewService';
import type { IssueViewApiResponse } from '../../api/types';

interface CreateProjectViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  projectId: string;
  onCreated: (view: IssueViewApiResponse) => void;
}

/**
 * Creates an empty saved view scoped to this project. Unlike the workspace
 * CreateViewDialog, there is no toolbar state to capture here — the filters are
 * set on the view's own page after it exists, which is what the shipped project
 * views page does too.
 */
export function CreateProjectViewDialog({
  open,
  onOpenChange,
  workspaceSlug,
  projectId,
  onCreated,
}: CreateProjectViewDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reopening starts from a blank form rather than the last attempt's text. */
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await viewService.create(workspaceSlug, {
        name: name.trim(),
        description: description.trim() || undefined,
        project_id: projectId,
      });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('views.createFailed', 'Failed to create view.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('views.newView', 'New view')}</DialogTitle>
          <DialogDescription>
            {t(
              'views.createProjectViewDescription',
              'A view saves a set of filters so the work you look at every day is one click away.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form id="create-project-view-v2-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-project-view-name">{t('views.title', 'Title')}</Label>
            <Input
              id="create-project-view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('views.viewNamePlaceholder', 'View name')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-project-view-description">
              {t('views.description', 'Description')}
            </Label>
            <Textarea
              id="create-project-view-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('views.optionalDescription', 'Optional description')}
              rows={3}
            />
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
          <Button
            type="submit"
            form="create-project-view-v2-form"
            disabled={submitting || !name.trim()}
          >
            {submitting ? t('common.creating', 'Creating…') : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
