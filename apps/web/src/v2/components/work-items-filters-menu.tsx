import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Calendar } from '@/v2/components/ui/calendar';
import { Checkbox } from '@/v2/components/ui/checkbox';
import { Label } from '@/v2/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/v2/components/ui/popover';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import { Separator } from '@/v2/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/v2/components/ui/toggle-group';
import { getImageUrl } from '@/lib/utils';
import {
  DEFAULT_PROJECT_ISSUES_FILTERS,
  type ProjectIssuesFiltersState,
} from '../../lib/projectIssuesEvents';
import {
  DATE_PRESETS,
  PRIORITIES,
  STATE_GROUPS,
  type DatePreset,
  type GroupingOption,
  type Priority,
  type StateGroup,
} from '../../types/workspaceViewFilters';
import type {
  CycleApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';

interface WorkItemsFiltersMenuProps {
  filters: ProjectIssuesFiltersState;
  onChange: (next: ProjectIssuesFiltersState) => void;
  labels: LabelApiResponse[];
  cycles: CycleApiResponse[];
  members: WorkspaceMemberApiResponse[];
}

/** How many filters the reader can currently clear. */
export function countActiveIssueFilters(filters: ProjectIssuesFiltersState): number {
  return (
    filters.priorities.length +
    filters.stateGroups.length +
    filters.assigneeIds.length +
    filters.createdByIds.length +
    filters.mentionedUserIds.length +
    filters.labelIds.length +
    filters.cycleIds.length +
    filters.startDate.length +
    filters.dueDate.length +
    (filters.workItemGrouping === 'all' ? 0 : 1)
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

interface CheckRowProps {
  id: string;
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CheckRow({ id, checked, onToggle, children }: CheckRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <Label htmlFor={id} className="text-muted-foreground min-w-0 gap-2 font-normal">
        {children}
      </Label>
    </div>
  );
}

function toIsoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseIsoDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

/**
 * Every filter the shipped work item list offers, in one shadcn popover: the
 * same ProjectIssuesFiltersState shape, so switching between the two designs
 * narrows the list identically.
 */
export function WorkItemsFiltersMenu({
  filters,
  onChange,
  labels,
  cycles,
  members,
}: WorkItemsFiltersMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activeCount = countActiveIssueFilters(filters);

  const patch = (next: Partial<ProjectIssuesFiltersState>) => onChange({ ...filters, ...next });

  function toggleIn<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
  }

  const memberLabel = (member: WorkspaceMemberApiResponse) =>
    member.member_display_name?.trim() ||
    member.member_email?.trim() ||
    t('common.member', 'Member');

  const memberInitials = (member: WorkspaceMemberApiResponse) =>
    memberLabel(member)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

  const stateGroupLabels: Record<StateGroup, string> = {
    backlog: t('stateGroup.backlog', 'Backlog'),
    unstarted: t('stateGroup.unstarted', 'Todo'),
    started: t('stateGroup.started', 'In Progress'),
    completed: t('stateGroup.completed', 'Done'),
    canceled: t('stateGroup.canceled', 'Cancelled'),
  };

  const priorityLabels: Record<Priority, string> = {
    urgent: t('priority.urgent', 'Urgent'),
    high: t('priority.high', 'High'),
    medium: t('priority.medium', 'Medium'),
    low: t('priority.low', 'Low'),
    none: t('priority.none', 'None'),
  };

  const datePresetLabels: Record<DatePreset, string> = {
    '1_week': t('filters.datePreset1Week', '1 week from now'),
    '2_weeks': t('filters.datePreset2Weeks', '2 weeks from now'),
    '1_month': t('filters.datePreset1Month', '1 month from now'),
    '2_months': t('filters.datePreset2Months', '2 months from now'),
    custom: t('common.custom', 'Custom'),
  };

  const memberSection = (
    title: string,
    key: 'assigneeIds' | 'createdByIds' | 'mentionedUserIds',
  ) => (
    <Section title={title}>
      {members.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('common.none', 'None')}</p>
      ) : (
        members.map((member) => {
          const id = member.member_id ?? member.id;
          return (
            <CheckRow
              key={`${key}-${member.id}`}
              id={`filter-${key}-${member.id}`}
              checked={filters[key].includes(id)}
              onToggle={() => patch({ [key]: toggleIn(filters[key], id) })}
            >
              <Avatar className="size-5">
                <AvatarImage src={getImageUrl(member.member_avatar) ?? ''} alt="" />
                <AvatarFallback className="text-[10px]">{memberInitials(member)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{memberLabel(member)}</span>
            </CheckRow>
          );
        })
      )}
    </Section>
  );

  const dateSection = (
    title: string,
    key: 'startDate' | 'dueDate',
    afterKey: 'startAfter' | 'dueAfter',
    beforeKey: 'startBefore' | 'dueBefore',
  ) => (
    <Section title={title}>
      {DATE_PRESETS.map((preset) => (
        <CheckRow
          key={`${key}-${preset}`}
          id={`filter-${key}-${preset}`}
          checked={filters[key].includes(preset)}
          onToggle={() => {
            const nextPresets = toggleIn(filters[key], preset);
            patch({
              [key]: nextPresets,
              ...(preset === 'custom' && !nextPresets.includes('custom')
                ? { [afterKey]: null, [beforeKey]: null }
                : {}),
            });
          }}
        >
          {datePresetLabels[preset]}
        </CheckRow>
      ))}
      {filters[key].includes('custom') && (
        <Calendar
          mode="range"
          className="rounded-md border p-2"
          selected={{
            from: parseIsoDate(filters[afterKey]),
            to: parseIsoDate(filters[beforeKey]),
          }}
          onSelect={(range) =>
            patch({
              [afterKey]: range?.from ? toIsoDate(range.from) : null,
              [beforeKey]: range?.to ? toIsoDate(range.to) : null,
            })
          }
        />
      )}
    </Section>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-11 border-dashed sm:h-9">
          <Filter aria-hidden="true" />
          {t('common.filters', 'Filters')}
          {activeCount > 0 && (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="min-w-5 px-1.5 tabular-nums">
                {activeCount}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      {/* The popper reports how much room is left below the trigger; capping the
          panel there keeps the bottom of the scroll area on screen instead of
          letting a fixed 30rem run past the viewport on a short window. */}
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="flex max-h-(--radix-popover-content-available-height) w-80 flex-col p-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-medium">{t('common.filters', 'Filters')}</p>
          {activeCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => onChange({ ...DEFAULT_PROJECT_ISSUES_FILTERS })}
            >
              {t('common.reset', 'Reset')}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[min(70vh,30rem)] min-h-0 flex-1">
          <div className="space-y-4 p-4">
            <Section title={t('filters.workItemGrouping', 'Work item Grouping')}>
              {/* Stacked rather than side by side: the three labels are full
                  sentences ("Backlog Work items"), and three of them never fit
                  across a 20rem popover in any language. ToggleGroupItem is
                  `shrink-0`, so a horizontal row does not truncate — it spills
                  out of the panel. `spacing` keeps each option its own bordered
                  row instead of the joined segments, whose rounding and
                  collapsed borders are written for a horizontal group. */}
              <ToggleGroup
                type="single"
                value={filters.workItemGrouping}
                onValueChange={(value) => {
                  if (value) patch({ workItemGrouping: value as GroupingOption });
                }}
                variant="outline"
                spacing={2}
                className="w-full flex-col items-stretch"
              >
                <ToggleGroupItem value="all" className="w-full justify-start">
                  {t('filters.allWorkItems', 'All Work items')}
                </ToggleGroupItem>
                <ToggleGroupItem value="active" className="w-full justify-start">
                  {t('filters.activeWorkItems', 'Active Work items')}
                </ToggleGroupItem>
                <ToggleGroupItem value="backlog" className="w-full justify-start">
                  {t('filters.backlogWorkItems', 'Backlog Work items')}
                </ToggleGroupItem>
              </ToggleGroup>
            </Section>

            <Separator />

            <Section title={t('filters.priority', 'Priority')}>
              {PRIORITIES.map((priority) => (
                <CheckRow
                  key={priority}
                  id={`filter-priority-${priority}`}
                  checked={filters.priorities.includes(priority)}
                  onToggle={() => patch({ priorities: toggleIn(filters.priorities, priority) })}
                >
                  {priorityLabels[priority]}
                </CheckRow>
              ))}
            </Section>

            <Separator />

            <Section title={t('filters.state', 'State')}>
              {STATE_GROUPS.map((group) => (
                <CheckRow
                  key={group}
                  id={`filter-state-${group}`}
                  checked={filters.stateGroups.includes(group)}
                  onToggle={() => patch({ stateGroups: toggleIn(filters.stateGroups, group) })}
                >
                  {stateGroupLabels[group]}
                </CheckRow>
              ))}
            </Section>

            <Separator />
            {memberSection(t('filters.assignee', 'Assignee'), 'assigneeIds')}
            <Separator />
            {memberSection(t('filters.createdBy', 'Created by'), 'createdByIds')}
            <Separator />
            {memberSection(t('filters.mention', 'Mention'), 'mentionedUserIds')}

            <Separator />

            <Section title={t('filters.label', 'Label')}>
              {labels.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t('common.none', 'None')}</p>
              ) : (
                labels.map((label) => (
                  <CheckRow
                    key={label.id}
                    id={`filter-label-${label.id}`}
                    checked={filters.labelIds.includes(label.id)}
                    onToggle={() => patch({ labelIds: toggleIn(filters.labelIds, label.id) })}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: label.color || 'var(--muted-foreground)' }}
                    />
                    <span className="truncate">{label.name}</span>
                  </CheckRow>
                ))
              )}
            </Section>

            <Separator />

            <Section title={t('filters.cycle', 'Cycle')}>
              {cycles.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t('common.none', 'None')}</p>
              ) : (
                cycles.map((cycle) => (
                  <CheckRow
                    key={cycle.id}
                    id={`filter-cycle-${cycle.id}`}
                    checked={filters.cycleIds.includes(cycle.id)}
                    onToggle={() => patch({ cycleIds: toggleIn(filters.cycleIds, cycle.id) })}
                  >
                    <span className="truncate">{cycle.name}</span>
                  </CheckRow>
                ))
              )}
            </Section>

            <Separator />
            {dateSection(
              t('filters.startDate', 'Start date'),
              'startDate',
              'startAfter',
              'startBefore',
            )}
            <Separator />
            {dateSection(t('filters.dueDate', 'Due date'), 'dueDate', 'dueAfter', 'dueBefore')}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
