import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import { useWorkspaceViewsState } from '../../contexts/WorkspaceViewsStateContext';
import { viewService } from '../../services/viewService';
import { workspaceViewFiltersToSearchParams } from '../../types/workspaceViewFilters';
import type { DisplayPropertyKey } from '../../types/workspaceViewDisplay';
import type { IssueViewApiResponse } from '../../api/types';

export interface CreateViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  onCreated?: (view: IssueViewApiResponse) => void;
}

/**
 * Saves the toolbar's current filters and display settings as a named view.
 *
 * The shipped CreateViewModal lets the filters be edited inside the dialog; here
 * they are taken as they stand in the toolbar, which is where the user just set
 * them — the dialog only asks for the name.
 */
export function CreateViewDialog({
  open,
  onOpenChange,
  workspaceSlug,
  onCreated,
}: CreateViewDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { filters, display } = useWorkspaceViewsState();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reopening starts from a blank form rather than the last attempt's text. */
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('views.titleRequired', 'Title is required.'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const display_properties: Record<string, boolean> = {};
      display.properties.forEach((key: DisplayPropertyKey) => {
        display_properties[key] = true;
      });
      const created = await viewService.create(workspaceSlug, {
        name: title.trim(),
        description: description.trim() || undefined,
        filters: workspaceViewFiltersToSearchParams(filters) as Record<string, unknown>,
        display_filters: { sub_issue: display.showSubWorkItems, layout: display.layout },
        display_properties,
      });
      onOpenChange(false);
      onCreated?.(created);
      navigate(`/${workspaceSlug}/views/${created.id}`);
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
          <DialogTitle>{t('views.createView', 'Create View')}</DialogTitle>
          <DialogDescription>
            {t(
              'views.createViewDescription',
              'Saves the filters and display settings currently in the toolbar.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form id="create-view-v2-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-view-title">{t('views.title', 'Title')}</Label>
            <Input
              id="create-view-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('views.viewNamePlaceholder', 'View name')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-view-description">{t('views.description', 'Description')}</Label>
            <Textarea
              id="create-view-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('views.optionalDescription', 'Optional description')}
              rows={3}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" form="create-view-v2-form" disabled={submitting || !title.trim()}>
            {t('views.createView', 'Create View')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
