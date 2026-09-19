import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GaugeIcon, GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/v2/components/ui/alert-dialog';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/v2/components/ui/empty';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Switch } from '@/v2/components/ui/switch';
import { SettingsPanel, apiErrorMessage } from '@/v2/components/settings/settings-panel';
import { estimateService } from '../../../../services/estimateService';
import type { EstimateApiResponse } from '../../../../api/types';

interface ProjectEstimatesPanelProps {
  workspaceSlug: string;
  projectId: string;
}

const ESTIMATE_TYPES = ['points', 'categories'] as const;

interface EstimatePayload {
  name: string;
  type: string;
  last_used: boolean;
  points: { key: number; value: string }[];
}

interface EstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EstimateApiResponse | null;
  onSubmit: (payload: EstimatePayload) => Promise<void>;
}

/** Create / edit an estimate system: name, type, and an ordered list of points. */
function EstimateDialog({ open, onOpenChange, initial, onSubmit }: EstimateDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState('points');
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<string[]>(['', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setType(initial?.type ?? 'points');
    setActive(initial?.last_used ?? false);
    setPoints(
      initial && initial.points.length > 0 ? initial.points.map((p) => p.value) : ['', '', ''],
    );
    setError(null);
  }, [open, initial]);

  const setPointAt = (index: number, value: string) =>
    setPoints((prev) => prev.map((p, i) => (i === index ? value : p)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const values = points.map((p) => p.trim()).filter(Boolean);
    if (!trimmedName || submitting) return;
    if (values.length === 0) {
      setError(t('settings.estimates.error.needPoint', 'Add at least one estimate point.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: trimmedName,
        type,
        last_used: active,
        points: values.map((value, key) => ({ key, value })),
      });
      onOpenChange(false);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          t('settings.estimates.error.save', 'Could not save the estimate system.'),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial
              ? t('settings.estimates.editTitle', 'Edit estimate system')
              : t('settings.estimates.newTitle', 'New estimate system')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'settings.estimates.dialogDescription',
              'Name the system and list its values in order, from smallest to largest.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form id="estimate-v2-form" className="flex flex-col gap-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="estimate-name">{t('common.name', 'Name')}</Label>
            <Input
              id="estimate-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.estimates.namePlaceholder', 'e.g. T-Shirt sizes')}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimate-type">{t('settings.estimates.type', 'Type')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="estimate-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTIMATE_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(
                      `settings.estimates.typeOption.${value}`,
                      value === 'points' ? 'Points' : 'Categories',
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm leading-none font-medium">
              {t('settings.estimates.points', 'Points')}
            </legend>
            <div className="flex flex-col gap-2">
              {points.map((point, index) => (
                <div key={index} className="flex items-center gap-2">
                  <GripVerticalIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <Input
                    value={point}
                    onChange={(e) => setPointAt(index, e.target.value)}
                    placeholder={t('settings.estimates.pointPlaceholder', 'Point {{n}}', {
                      n: index + 1,
                    })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    disabled={points.length <= 1}
                    aria-label={t('settings.estimates.removePoint', 'Remove point {{n}}', {
                      n: index + 1,
                    })}
                    onClick={() => setPoints((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPoints((prev) => [...prev, ''])}
            >
              <PlusIcon />
              {t('settings.estimates.addPoint', 'Add point')}
            </Button>
          </fieldset>

          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
            <div className="min-w-0">
              <Label htmlFor="estimate-active" className="text-sm font-medium">
                {t('settings.estimates.setActiveLabel', 'Set as the active estimate system')}
              </Label>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {t(
                  'settings.estimates.setActiveHint',
                  'Work items in this project use the active system.',
                )}
              </p>
            </div>
            <Switch id="estimate-active" checked={active} onCheckedChange={setActive} />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" form="estimate-v2-form" disabled={!name.trim() || submitting}>
            {submitting
              ? t('common.saving', 'Saving…')
              : initial
                ? t('common.saveChanges', 'Save changes')
                : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Project settings → Estimates. Lists the project's estimate systems and lets
 * members create, edit, delete, and pick the active one.
 */
export function ProjectEstimatesPanel({ workspaceSlug, projectId }: ProjectEstimatesPanelProps) {
  const { t } = useTranslation();
  const [estimates, setEstimates] = useState<EstimateApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateApiResponse | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EstimateApiResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setEstimates((await estimateService.list(workspaceSlug, projectId)) ?? []);
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    estimateService
      .list(workspaceSlug, projectId)
      .then((list) => {
        if (!cancelled) setEstimates(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setEstimates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const makeActive = async (estimate: EstimateApiResponse) => {
    if (estimate.last_used) return;
    setError(null);
    try {
      await estimateService.update(workspaceSlug, projectId, estimate.id, { last_used: true });
      await refresh();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          t('settings.estimates.error.activate', 'Could not switch the active estimate system.'),
        ),
      );
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError(null);
    try {
      await estimateService.remove(workspaceSlug, projectId, pendingDelete.id);
      await refresh();
      setPendingDelete(null);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          t('settings.estimates.error.delete', 'Could not delete the estimate system.'),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPanel
      title={t('settings.estimates.title', 'Estimates')}
      description={t(
        'settings.estimates.description',
        'Set up estimation systems to track and communicate the effort required for each work item.',
      )}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <PlusIcon />
          {t('settings.estimates.add', 'Add estimate')}
        </Button>
      }
    >
      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : estimates.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GaugeIcon />
            </EmptyMedia>
            <EmptyTitle>{t('settings.estimates.empty', 'No estimate systems yet.')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'settings.estimates.emptyHint',
                'Create one to assign effort estimates to work items.',
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {estimates.map((estimate) => (
            <div
              key={estimate.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-lg border px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{estimate.name}</span>
                  {estimate.last_used && (
                    <Badge variant="default">{t('settings.estimates.active', 'Active')}</Badge>
                  )}
                  <Badge variant="outline" className="capitalize">
                    {t(
                      `settings.estimates.typeOption.${estimate.type}`,
                      estimate.type === 'categories' ? 'Categories' : 'Points',
                    )}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {estimate.points.map((point) => (
                    <span
                      key={point.id}
                      className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs"
                    >
                      {point.value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!estimate.last_used && (
                  <Button variant="outline" size="sm" onClick={() => void makeActive(estimate)}>
                    {t('settings.estimates.setActive', 'Set active')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(estimate);
                    setDialogOpen(true);
                  }}
                >
                  {t('common.edit', 'Edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete(estimate)}
                >
                  {t('common.delete', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EstimateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={async (payload) => {
          if (editing) {
            await estimateService.update(workspaceSlug, projectId, editing.id, payload);
          } else {
            await estimateService.create(workspaceSlug, projectId, payload);
          }
          await refresh();
        }}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !busy && !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.estimates.deleteTitle', 'Delete this estimate system?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'settings.estimates.deleteDescription',
                'Work items using {{name}} lose their estimate. This cannot be undone.',
                { name: pendingDelete?.name ?? '' },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {busy ? t('common.deleting', 'Deleting…') : t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPanel>
  );
}
