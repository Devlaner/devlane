import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Calendar } from '@/v2/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/v2/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/v2/components/ui/popover';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import { cn, getImageUrl } from '@/lib/utils';
import { PRIORITY_LABELS, PRIORITIES, formatDate, stateDotStyle } from '../lib/project';
import type { IssueInlinePatch } from '../../components/work-item/layouts/IssueLayoutTypes';
import type {
  IssueApiResponse,
  LabelApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';
import type { Priority } from '../../types';

interface InlineCellBaseProps {
  issue: IssueApiResponse;
  onUpdate: (patch: IssueInlinePatch) => void;
}

/** Shared trigger look: the value reads as text until the cell is hovered. */
function CellTrigger({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={label}
        className={cn(
          'text-foreground hover:bg-muted h-8 max-w-full justify-start gap-2 px-2 font-normal',
          className,
        )}
      >
        {children}
      </Button>
    </PopoverTrigger>
  );
}

export function InlineStateCell({
  issue,
  onUpdate,
  states,
}: InlineCellBaseProps & { states: StateApiResponse[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = states.find((state) => state.id === issue.state_id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <CellTrigger label={t('workItem.changeState', 'Change state')}>
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={stateDotStyle(current)}
        />
        <span className="truncate text-sm">{current?.name ?? t('common.noState', 'No state')}</span>
      </CellTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder={t('issues.searchStates', 'Search states')} />
          <CommandList>
            <CommandEmpty>{t('common.noResults', 'No results')}</CommandEmpty>
            <CommandGroup>
              {states.map((state) => (
                <CommandItem
                  key={state.id}
                  value={state.name}
                  onSelect={() => {
                    if (state.id !== issue.state_id) onUpdate({ state_id: state.id });
                    setOpen(false);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={stateDotStyle(state)}
                  />
                  <span className="truncate">{state.name}</span>
                  {state.id === issue.state_id && <CheckIcon className="ml-auto size-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function InlinePriorityCell({ issue, onUpdate }: InlineCellBaseProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = (issue.priority ?? 'none') as Priority;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <CellTrigger label={t('workItem.changePriority', 'Change priority')}>
        <Badge variant={current === 'urgent' ? 'destructive' : 'secondary'}>
          {PRIORITY_LABELS[current] ?? current}
        </Badge>
      </CellTrigger>
      <PopoverContent align="start" className="w-44 p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {PRIORITIES.map((priority) => (
                <CommandItem
                  key={priority}
                  value={priority}
                  onSelect={() => {
                    if (priority !== current) onUpdate({ priority });
                    setOpen(false);
                  }}
                >
                  {PRIORITY_LABELS[priority]}
                  {priority === current && <CheckIcon className="ml-auto size-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function InlineAssigneeCell({
  issue,
  onUpdate,
  members,
  maxAvatars = 3,
}: InlineCellBaseProps & { members: WorkspaceMemberApiResponse[]; maxAvatars?: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = issue.assignee_ids ?? [];

  const memberLabel = (member: WorkspaceMemberApiResponse) =>
    member.member_display_name?.trim() ||
    member.member_email?.trim() ||
    t('common.member', 'Member');

  const initials = (member: WorkspaceMemberApiResponse) =>
    memberLabel(member)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

  const shown = selected.slice(0, maxAvatars);
  const extra = selected.length - shown.length;

  const toggle = (memberId: string) => {
    const next = selected.includes(memberId)
      ? selected.filter((id) => id !== memberId)
      : [...selected, memberId];
    onUpdate({ assignee_ids: next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <CellTrigger label={t('workItem.changeAssignees', 'Change assignees')}>
        {selected.length === 0 ? (
          <span className="text-muted-foreground text-xs">
            {t('issues.unassigned', 'Unassigned')}
          </span>
        ) : (
          <span className="flex -space-x-2">
            {shown.map((memberId) => {
              const member = members.find((entry) => (entry.member_id ?? entry.id) === memberId);
              return (
                <Avatar key={memberId} className="border-background size-6 border-2">
                  <AvatarImage src={getImageUrl(member?.member_avatar) ?? ''} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {member ? initials(member) : '?'}
                  </AvatarFallback>
                </Avatar>
              );
            })}
            {extra > 0 && (
              <span className="border-background bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-medium">
                +{extra}
              </span>
            )}
          </span>
        )}
      </CellTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput placeholder={t('issues.searchMembers', 'Search members')} />
          <CommandList className="max-h-none">
            <ScrollArea className="h-56">
              <CommandEmpty>{t('common.noResults', 'No results')}</CommandEmpty>
              <CommandGroup>
                {members.map((member) => {
                  const id = member.member_id ?? member.id;
                  const isSelected = selected.includes(id);
                  return (
                    <CommandItem
                      key={member.id}
                      value={memberLabel(member)}
                      onSelect={() => toggle(id)}
                    >
                      <Avatar className="size-5">
                        <AvatarImage src={getImageUrl(member.member_avatar) ?? ''} alt="" />
                        <AvatarFallback className="text-[10px]">{initials(member)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{memberLabel(member)}</span>
                      {isSelected && <CheckIcon className="ml-auto size-4" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function InlineLabelsCell({
  issue,
  onUpdate,
  labels,
  maxChips = 2,
}: InlineCellBaseProps & { labels: LabelApiResponse[]; maxChips?: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = (issue.label_ids ?? []).filter((id) => labels.some((l) => l.id === id));
  const shown = selected.slice(0, maxChips);
  const extra = selected.length - shown.length;

  const toggle = (labelId: string) => {
    const next = selected.includes(labelId)
      ? selected.filter((id) => id !== labelId)
      : [...selected, labelId];
    onUpdate({ label_ids: next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <CellTrigger label={t('workItem.changeLabels', 'Change labels')}>
        {selected.length === 0 ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {shown.map((id) => {
              const label = labels.find((entry) => entry.id === id);
              return (
                <Badge key={id} variant="outline" className="max-w-28">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: label?.color || 'var(--muted-foreground)' }}
                  />
                  <span className="truncate">{label?.name}</span>
                </Badge>
              );
            })}
            {extra > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                +{extra}
              </Badge>
            )}
          </span>
        )}
      </CellTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput placeholder={t('issues.searchLabels', 'Search labels')} />
          <CommandList className="max-h-none">
            <ScrollArea className="h-56">
              <CommandEmpty>{t('common.noResults', 'No results')}</CommandEmpty>
              <CommandGroup>
                {labels.map((label) => (
                  <CommandItem key={label.id} value={label.name} onSelect={() => toggle(label.id)}>
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: label.color || 'var(--muted-foreground)' }}
                    />
                    <span className="truncate">{label.name}</span>
                    {selected.includes(label.id) && <CheckIcon className="ml-auto size-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function toIsoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function InlineDateCell({
  issue,
  onUpdate,
  field,
}: InlineCellBaseProps & { field: 'start_date' | 'target_date' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const value = issue[field];
  const parsed = value && !Number.isNaN(Date.parse(value)) ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <CellTrigger
        label={
          field === 'start_date'
            ? t('workItem.changeStartDate', 'Change start date')
            : t('workItem.changeDueDate', 'Change due date')
        }
      >
        <span className={cn('text-sm', !parsed && 'text-muted-foreground')}>
          {parsed ? formatDate(value) : '—'}
        </span>
      </CellTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          autoFocus
          selected={parsed}
          onSelect={(date) => {
            onUpdate({ [field]: date ? toIsoDate(date) : null } as IssueInlinePatch);
            setOpen(false);
          }}
        />
        {parsed && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onUpdate({ [field]: null } as IssueInlinePatch);
                setOpen(false);
              }}
            >
              {t('common.clear', 'Clear')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
