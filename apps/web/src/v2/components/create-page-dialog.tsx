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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { pageService } from '../../services/pageService';

interface CreatePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  projectId: string;
}

/**
 * Creates a page and opens it. A page is written into rather than configured,
 * so the dialog asks only for a title and who can see it, then navigates to the
 * editor — the same move the shipped page makes.
 */
export function CreatePageDialog({
  open,
  onOpenChange,
  workspaceSlug,
  projectId,
}: CreatePageDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  /* 0 public, 1 private — the API's own encoding. */
  const [access, setAccess] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reopening starts from a blank form rather than the last attempt's text. */
  useEffect(() => {
    if (!open) {
      setName('');
      setAccess('0');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await pageService.create(workspaceSlug, {
        /* An untitled page is a normal way to start writing, so an empty field
           is filled in rather than rejected. */
        name: name.trim() || t('pages.untitledPage', 'Untitled page'),
        project_id: projectId,
        access: Number(access),
      });
      onOpenChange(false);
      navigate(`/${workspaceSlug}/projects/${projectId}/pages/${created.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('pages.createFailed', 'Failed to create page.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.newPage', 'New page')}</DialogTitle>
          <DialogDescription>
            {t(
              'pages.createDescription',
              'Pages hold the writing around the work — specs, notes and decisions.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form id="create-page-v2-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-page-name">{t('common.title', 'Title')}</Label>
            <Input
              id="create-page-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('pages.untitledPage', 'Untitled page')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-page-access">{t('pages.access', 'Access')}</Label>
            <Select value={access} onValueChange={setAccess}>
              <SelectTrigger id="create-page-access" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('pages.public', 'Public')}</SelectItem>
                <SelectItem value="1">{t('pages.private', 'Private')}</SelectItem>
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
          <Button type="submit" form="create-page-v2-form" disabled={submitting}>
            {submitting ? t('common.creating', 'Creating…') : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
