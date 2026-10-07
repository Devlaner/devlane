import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import type { ListFilterGroup } from '@/v2/components/list-filters-menu';

interface ListFilterChipsProps {
  /** The same group config the filter popover is built from. */
  groups: ListFilterGroup[];
  /** Selected values per group key; an empty array means the group is off. */
  selected: Record<string, string[]>;
  onToggle: (groupKey: string, value: string) => void;
  onReset: () => void;
}

/**
 * The active filters of a v2 project list, spelled out under its toolbar.
 *
 * These lists remember their filters between visits, so the narrowing that
 * produced a short — or empty — list was usually chosen on an earlier visit.
 * A count inside the filter trigger is enough to *notice*; naming each active
 * filter next to the list is what stops a filtered-away list from reading as
 * missing data. The chips carry their own removal, so undoing one does not
 * require finding it again inside the popover.
 *
 * Rendered through ProjectListToolbar's `chips` slot, matching the row
 * ProjectsToolbar and ArchivesToolbar already show.
 */
export function ListFilterChips({ groups, selected, onToggle, onReset }: ListFilterChipsProps) {
  const { t } = useTranslation();

  const chips = groups.flatMap((group) =>
    (selected[group.key] ?? []).map((value) => ({
      key: `${group.key}:${value}`,
      groupKey: group.key,
      value,
      /* An unknown value can only come from a hand-edited URL or a filter that
         has since been removed; showing it raw still lets it be cleared. */
      label: group.options.find((option) => option.value === value)?.label ?? value,
    })),
  );

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-t pt-3"
      aria-label={t('projects.activeFilters', 'Active filters')}
    >
      <span className="text-muted-foreground text-xs font-medium">
        {t('projects.activeFilters', 'Active filters')}
      </span>
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="h-8 gap-1 pr-1 pl-2.5">
          <span className="max-w-48 truncate">{chip.label}</span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="hover:bg-background/80 size-6 rounded-full"
            onClick={() => onToggle(chip.groupKey, chip.value)}
            aria-label={t('common.removeFilter', 'Remove {{filter}} filter', {
              filter: chip.label,
            })}
          >
            <X aria-hidden="true" />
          </Button>
        </Badge>
      ))}
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onReset}>
        {t('common.clearAll', 'Clear all')}
      </Button>
    </div>
  );
}
