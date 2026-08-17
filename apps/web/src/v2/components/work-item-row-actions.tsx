import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Archive, Flag, Link2, MoreHorizontal, SquarePen, Trash2 } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/v2/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import { PRIORITIES, PRIORITY_LABELS } from '../lib/project';
import type { IssueApiResponse, StateApiResponse } from '../../api/types';

export interface WorkItemRowActions {
  issue: IssueApiResponse;
  states: StateApiResponse[];
  issueUrl: string;
  onChangeState: (stateId: string) => void;
  onChangePriority: (priority: string) => void;
  onCopyLink: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/**
 * The row's actions, offered twice over the same handlers: a kebab button for
 * pointer and keyboard users, and a right-click menu for the desktop habit. The
 * two menus stay in sync because they are declared side by side here.
 */
export function WorkItemActionsMenu({
  issue,
  states,
  issueUrl,
  onChangeState,
  onChangePriority,
  onCopyLink,
  onArchive,
  onDelete,
  menuLabel,
}: WorkItemRowActions & { menuLabel: string }) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-10 sm:size-8"
          aria-label={menuLabel}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link to={issueUrl}>
            <SquarePen aria-hidden="true" />
            {t('issues.openWorkItem', 'Open work item')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopyLink}>
          <Link2 aria-hidden="true" />
          {t('common.copyLink', 'Copy link')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Flag aria-hidden="true" />
            {t('views.state', 'State')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 w-52 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={issue.state_id ?? ''}
              onValueChange={(value) => onChangeState(value)}
            >
              {states.map((state) => (
                <DropdownMenuRadioItem key={state.id} value={state.id}>
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: state.color || 'var(--muted-foreground)' }}
                  />
                  {state.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Flag aria-hidden="true" />
            {t('views.priority', 'Priority')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuRadioGroup
              value={issue.priority ?? 'none'}
              onValueChange={(value) => onChangePriority(value)}
            >
              {PRIORITIES.map((priority) => (
                <DropdownMenuRadioItem key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onArchive}>
          <Archive aria-hidden="true" />
          {t('common.archive', 'Archive')}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden="true" />
          {t('common.delete', 'Delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Wraps a row so right-clicking it offers the same actions as the kebab menu. */
export function WorkItemContextMenu({
  issue,
  states,
  issueUrl,
  onChangeState,
  onChangePriority,
  onCopyLink,
  onArchive,
  onDelete,
  children,
}: WorkItemRowActions & { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem asChild>
          <Link to={issueUrl}>
            <SquarePen aria-hidden="true" />
            {t('issues.openWorkItem', 'Open work item')}
          </Link>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCopyLink}>
          <Link2 aria-hidden="true" />
          {t('common.copyLink', 'Copy link')}
        </ContextMenuItem>

        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag aria-hidden="true" />
            {t('views.state', 'State')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-72 w-52 overflow-y-auto">
            <ContextMenuRadioGroup
              value={issue.state_id ?? ''}
              onValueChange={(value) => onChangeState(value)}
            >
              {states.map((state) => (
                <ContextMenuRadioItem key={state.id} value={state.id}>
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: state.color || 'var(--muted-foreground)' }}
                  />
                  {state.name}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag aria-hidden="true" />
            {t('views.priority', 'Priority')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            <ContextMenuRadioGroup
              value={issue.priority ?? 'none'}
              onValueChange={(value) => onChangePriority(value)}
            >
              {PRIORITIES.map((priority) => (
                <ContextMenuRadioItem key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onArchive}>
          <Archive aria-hidden="true" />
          {t('common.archive', 'Archive')}
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden="true" />
          {t('common.delete', 'Delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
