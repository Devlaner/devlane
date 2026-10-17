import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Flag, Rows3, Trash2, X } from 'lucide-react';
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
import { Button } from '@/v2/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import { Separator } from '@/v2/components/ui/separator';
import { PRIORITIES, PRIORITY_LABELS } from '../lib/project';
import type { StateApiResponse } from '../../api/types';

interface WorkItemsBulkBarProps {
  selectedCount: number;
  states: StateApiResponse[];
  busy: boolean;
  onChangeState: (stateId: string) => void;
  onChangePriority: (priority: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Actions for the current selection. It replaces per-row repetition for the
 * common case — moving a handful of items to the same state — and asks before
 * the two actions that are not a single undo away.
 */
export function WorkItemsBulkBar({
  selectedCount,
  states,
  busy,
  onChangeState,
  onChangePriority,
  onArchive,
  onDelete,
  onClear,
}: WorkItemsBulkBarProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<'archive' | 'delete' | null>(null);

  if (selectedCount === 0) return null;

  return (
    <div
      className="bg-card sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border p-2 shadow-lg"
      role="region"
      aria-label={t('issues.bulkActions', 'Bulk actions')}
    >
      <span className="px-2 text-sm font-medium tabular-nums" aria-live="polite">
        {t('issues.selectedCount', '{{count}} selected', { count: selectedCount })}
      </span>
      <Separator orientation="vertical" className="data-[orientation=vertical]:h-6" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={busy}>
            <Rows3 aria-hidden="true" />
            {t('views.state', 'State')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto">
          <DropdownMenuLabel>{t('issues.moveToState', 'Move to state')}</DropdownMenuLabel>
          {states.map((state) => (
            <DropdownMenuItem key={state.id} onSelect={() => onChangeState(state.id)}>
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: state.color || 'var(--muted-foreground)' }}
              />
              {state.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={busy}>
            <Flag aria-hidden="true" />
            {t('views.priority', 'Priority')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>{t('issues.setPriority', 'Set priority')}</DropdownMenuLabel>
          {PRIORITIES.map((priority) => (
            <DropdownMenuItem key={priority} onSelect={() => onChangePriority(priority)}>
              {PRIORITY_LABELS[priority]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setConfirming('archive')}
      >
        <Archive aria-hidden="true" />
        {t('common.archive', 'Archive')}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => setConfirming('delete')}
      >
        <Trash2 aria-hidden="true" />
        {t('common.delete', 'Delete')}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="ml-auto"
        onClick={onClear}
        disabled={busy}
      >
        <X aria-hidden="true" />
        {t('common.clearSelection', 'Clear selection')}
      </Button>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => setConfirming(open ? confirming : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === 'delete'
                ? t('issues.confirmDeleteTitle', 'Delete {{count}} work items?', {
                    count: selectedCount,
                  })
                : t('issues.confirmArchiveTitle', 'Archive {{count}} work items?', {
                    count: selectedCount,
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === 'delete'
                ? t(
                    'issues.confirmDeleteDescription',
                    'Deleted work items cannot be restored. Their comments, attachments, and links go with them.',
                  )
                : t(
                    'issues.confirmArchiveDescription',
                    'Archived work items leave this list and stay available under Archives.',
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirming === 'delete' ? 'destructive' : 'default'}
              onClick={() => {
                if (confirming === 'delete') onDelete();
                else onArchive();
                setConfirming(null);
              }}
            >
              {confirming === 'delete'
                ? t('common.delete', 'Delete')
                : t('common.archive', 'Archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
