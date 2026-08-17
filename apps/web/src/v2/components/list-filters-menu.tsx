import { useTranslation } from 'react-i18next';
import { Filter } from 'lucide-react';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Checkbox } from '@/v2/components/ui/checkbox';
import { Label } from '@/v2/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/v2/components/ui/popover';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import { Separator } from '@/v2/components/ui/separator';

export interface ListFilterOption {
  value: string;
  label: string;
  /** Colour of the leading dot — states and statuses carry one. */
  color?: string;
}

export interface ListFilterGroup {
  /** The URL param this group is stored in. */
  key: string;
  label: string;
  options: ListFilterOption[];
}

interface ListFiltersMenuProps {
  groups: ListFilterGroup[];
  /** Selected values per group key; an empty array means the group is off. */
  selected: Record<string, string[]>;
  onToggle: (groupKey: string, value: string) => void;
  onReset: () => void;
}

/**
 * The checkbox filter popover the v2 project lists share — epics filter by
 * state and priority, modules by status, pages by access, and the panel is the
 * same one in each case, driven by a group config.
 *
 * The chrome deliberately matches CyclesFiltersMenu, whose panel was built
 * first: dashed trigger with a count of what can be cleared, a sticky header
 * carrying Reset, and a body capped at the room the popper reports so a long
 * state list ends on screen.
 */
export function ListFiltersMenu({ groups, selected, onToggle, onReset }: ListFiltersMenuProps) {
  const { t } = useTranslation();
  const activeCount = groups.reduce(
    (total, group) => total + (selected[group.key]?.length ?? 0),
    0,
  );

  return (
    <Popover>
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
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="max-h-(--radix-popover-content-available-height) w-72 overflow-hidden p-0"
      >
        <div className="flex h-11 items-center justify-between border-b px-4">
          <p className="text-sm font-medium">{t('common.filters', 'Filters')}</p>
          {activeCount > 0 && (
            <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onReset}>
              {t('common.reset', 'Reset')}
            </Button>
          )}
        </div>
        {/* Sized rather than flexed — see WorkItemsFiltersMenu: the viewport's
            `height: 100%` cannot resolve against a `flex-basis: 0` parent.
            2.875rem is the 44px header plus the panel's two 1px borders. */}
        <ScrollArea className="h-[min(70vh,26rem,calc(var(--radix-popover-content-available-height)-2.875rem))]">
          <div className="space-y-4 p-4">
            {groups.map((group, index) => (
              <div key={group.key} className="space-y-2">
                {index > 0 && <Separator className="mb-4" />}
                <p className="text-sm font-medium">{group.label}</p>
                <div className="space-y-1.5">
                  {group.options.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      {t('filters.noOptions', 'Nothing to filter by yet.')}
                    </p>
                  )}
                  {group.options.map((option) => {
                    const id = `list-filter-${group.key}-${option.value}`;
                    return (
                      <div key={option.value} className="flex items-center gap-2">
                        <Checkbox
                          id={id}
                          checked={(selected[group.key] ?? []).includes(option.value)}
                          onCheckedChange={() => onToggle(group.key, option.value)}
                        />
                        <Label htmlFor={id} className="text-muted-foreground min-w-0 font-normal">
                          {option.color && (
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: option.color }}
                            />
                          )}
                          <span className="truncate">{option.label}</span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
