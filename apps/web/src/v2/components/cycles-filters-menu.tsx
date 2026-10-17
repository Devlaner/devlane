import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter } from 'lucide-react';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Calendar } from '@/v2/components/ui/calendar';
import { Checkbox } from '@/v2/components/ui/checkbox';
import { Label } from '@/v2/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/v2/components/ui/popover';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import { Separator } from '@/v2/components/ui/separator';
import {
  DEFAULT_CYCLES_FILTERS,
  type CycleStatusFilterKey,
  type CyclesFiltersState,
  type DatePresetFilterKey,
} from '../hooks/useProjectCyclesController';

const STATUS_KEYS: CycleStatusFilterKey[] = ['in_progress', 'yet_to_start', 'completed', 'draft'];
const DATE_PRESETS: DatePresetFilterKey[] = ['1_week', '2_weeks', '1_month', '2_months', 'custom'];

interface CyclesFiltersMenuProps {
  filters: CyclesFiltersState;
  onChange: (update: (previous: CyclesFiltersState) => CyclesFiltersState) => void;
}

/** How many filters the reader can currently clear (search excluded). */
export function countActiveCycleFilters(filters: CyclesFiltersState): number {
  return (
    filters.statusKeys.length + filters.startDatePresets.length + filters.dueDatePresets.length
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

/**
 * Status and date filters for the cycles list, over the same CyclesFiltersState
 * the shipped header broadcasts — so both designs narrow the list identically.
 */
export function CyclesFiltersMenu({ filters, onChange }: CyclesFiltersMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activeCount = countActiveCycleFilters(filters);

  const statusLabels: Record<CycleStatusFilterKey, string> = {
    in_progress: t('cycles.active', 'Active'),
    yet_to_start: t('cycles.upcoming', 'Upcoming'),
    completed: t('cycles.completed', 'Completed'),
    draft: t('cycles.draft', 'Draft'),
  };

  const presetLabels: Record<DatePresetFilterKey, string> = {
    '1_week': t('filters.datePreset1Week', '1 week from now'),
    '2_weeks': t('filters.datePreset2Weeks', '2 weeks from now'),
    '1_month': t('filters.datePreset1Month', '1 month from now'),
    '2_months': t('filters.datePreset2Months', '2 months from now'),
    custom: t('common.custom', 'Custom'),
  };

  const toggleStatus = (key: CycleStatusFilterKey) =>
    onChange((previous) => ({
      ...previous,
      statusKeys: previous.statusKeys.includes(key)
        ? previous.statusKeys.filter((entry) => entry !== key)
        : [...previous.statusKeys, key],
    }));

  const dateSection = (
    title: string,
    presetKey: 'startDatePresets' | 'dueDatePresets',
    afterKey: 'startAfter' | 'dueAfter',
    beforeKey: 'startBefore' | 'dueBefore',
  ) => (
    <Section title={title}>
      {DATE_PRESETS.map((preset) => (
        <div key={`${presetKey}-${preset}`} className="flex items-center gap-2">
          <Checkbox
            id={`cycle-filter-${presetKey}-${preset}`}
            checked={filters[presetKey].includes(preset)}
            onCheckedChange={() =>
              onChange((previous) => {
                const next = previous[presetKey].includes(preset)
                  ? previous[presetKey].filter((entry) => entry !== preset)
                  : [...previous[presetKey], preset];
                return {
                  ...previous,
                  [presetKey]: next,
                  ...(preset === 'custom' && !next.includes('custom')
                    ? { [afterKey]: null, [beforeKey]: null }
                    : {}),
                };
              })
            }
          />
          <Label
            htmlFor={`cycle-filter-${presetKey}-${preset}`}
            className="text-muted-foreground font-normal"
          >
            {presetLabels[preset]}
          </Label>
        </div>
      ))}
      {filters[presetKey].includes('custom') && (
        <Calendar
          mode="range"
          className="rounded-md border p-2"
          selected={{
            from: parseIsoDate(filters[afterKey]),
            to: parseIsoDate(filters[beforeKey]),
          }}
          onSelect={(range) =>
            onChange((previous) => ({
              ...previous,
              [afterKey]: range?.from ? toIsoDate(range.from) : null,
              [beforeKey]: range?.to ? toIsoDate(range.to) : null,
            }))
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
      {/* Capped at the room the popper reports below the trigger, so the panel
          ends on screen instead of running past the bottom of a short window. */}
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="max-h-(--radix-popover-content-available-height) w-80 overflow-hidden p-0"
      >
        <div className="flex h-11 items-center justify-between border-b px-4">
          <p className="text-sm font-medium">{t('common.filters', 'Filters')}</p>
          {activeCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() =>
                onChange((previous) => ({
                  ...DEFAULT_CYCLES_FILTERS,
                  searchQuery: previous.searchQuery,
                }))
              }
            >
              {t('common.reset', 'Reset')}
            </Button>
          )}
        </div>
        {/* Sized rather than flexed — see WorkItemsFiltersMenu: the viewport's
            `height: 100%` cannot resolve against a `flex-basis: 0` parent.
            2.875rem is the 44px header plus the panel's two 1px borders. */}
        <ScrollArea className="h-[min(70vh,26rem,calc(var(--radix-popover-content-available-height)-2.875rem))]">
          <div className="space-y-4 p-4">
            <Section title={t('common.status', 'Status')}>
              {STATUS_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`cycle-filter-status-${key}`}
                    checked={filters.statusKeys.includes(key)}
                    onCheckedChange={() => toggleStatus(key)}
                  />
                  <Label
                    htmlFor={`cycle-filter-status-${key}`}
                    className="text-muted-foreground font-normal"
                  >
                    {statusLabels[key]}
                  </Label>
                </div>
              ))}
            </Section>

            <Separator />
            {dateSection(
              t('filters.startDate', 'Start date'),
              'startDatePresets',
              'startAfter',
              'startBefore',
            )}
            <Separator />
            {dateSection(
              t('filters.dueDate', 'Due date'),
              'dueDatePresets',
              'dueAfter',
              'dueBefore',
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
