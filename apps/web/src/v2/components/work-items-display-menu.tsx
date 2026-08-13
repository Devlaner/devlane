import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { Checkbox } from '@/v2/components/ui/checkbox';
import { Label } from '@/v2/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/v2/components/ui/popover';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Separator } from '@/v2/components/ui/separator';
import {
  normalizeSubGroupBy,
  type ProjectIssuesDisplayState,
} from '../../lib/projectIssuesDisplay';
import {
  ALL_SAVED_VIEW_DISPLAY_PROPERTIES,
  SAVED_VIEW_DISPLAY_PROPERTY_LABELS,
  type SavedViewDisplayPropertyId,
  type SavedViewGroupBy,
  type SavedViewOrderBy,
} from '../../lib/projectSavedViewDisplay';

interface WorkItemsDisplayMenuProps {
  display: ProjectIssuesDisplayState;
  onChange: (next: ProjectIssuesDisplayState) => void;
}

/**
 * Group by, sub-group by, order by and the visible columns — the same display
 * model the shipped list uses (ProjectIssuesDisplayPanel), drawn with shadcn
 * primitives so the v2 surface differs in design only.
 */
export function WorkItemsDisplayMenu({ display, onChange }: WorkItemsDisplayMenuProps) {
  const { t } = useTranslation();

  const groupOptions: Array<{ value: SavedViewGroupBy; label: string }> = [
    { value: 'states', label: t('display.groupStates', 'States') },
    { value: 'priority', label: t('display.groupPriority', 'Priority') },
    { value: 'cycle', label: t('display.groupCycle', 'Cycle') },
    { value: 'module', label: t('display.groupModule', 'Module') },
    { value: 'labels', label: t('display.groupLabels', 'Labels') },
    { value: 'assignees', label: t('display.groupAssignees', 'Assignees') },
    { value: 'created_by', label: t('display.groupCreatedBy', 'Created by') },
    { value: 'none', label: t('display.groupNone', 'None') },
  ];

  const orderOptions: Array<{ value: SavedViewOrderBy; label: string }> = [
    { value: 'manual', label: t('display.orderManual', 'Manual') },
    { value: 'last_created', label: t('display.orderLastCreated', 'Last created') },
    { value: 'last_updated', label: t('display.orderLastUpdated', 'Last updated') },
    { value: 'start_date', label: t('display.orderStartDate', 'Start date') },
    { value: 'due_date', label: t('display.orderDueDate', 'Due date') },
    { value: 'priority', label: t('display.orderPriority', 'Priority') },
  ];

  const patch = (next: Partial<ProjectIssuesDisplayState>) => onChange({ ...display, ...next });

  const toggleProperty = (id: SavedViewDisplayPropertyId) => {
    const next = new Set(display.displayProperties);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patch({ displayProperties: next });
  };

  /* Sub-grouping only means something below a primary group, and never by the
     same dimension — the shared normalizer owns that rule. */
  const subGroupValue = normalizeSubGroupBy(display.groupBy, display.subGroupBy) ?? 'none';
  const subGroupDisabled = display.groupBy === 'none';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-11 sm:h-9">
          <SlidersHorizontal aria-hidden="true" />
          {t('display.display', 'Display')}
        </Button>
      </PopoverTrigger>
      {/* Capped at the room the popper reports below the trigger, so the panel
          ends on screen instead of running past the bottom of a short window. */}
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="flex max-h-(--radix-popover-content-available-height) w-72 flex-col p-0"
      >
        <ScrollArea className="h-[min(70vh,28rem)] min-h-0 flex-1">
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="work-items-group-by">{t('display.groupBy', 'Group by')}</Label>
              <Select
                value={display.groupBy}
                onValueChange={(value) => patch({ groupBy: value as SavedViewGroupBy })}
              >
                <SelectTrigger id="work-items-group-by" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work-items-sub-group-by">
                {t('display.subGroupBy', 'Sub-group by')}
              </Label>
              <Select
                value={subGroupValue}
                disabled={subGroupDisabled}
                onValueChange={(value) =>
                  patch({ subGroupBy: value === 'none' ? undefined : (value as SavedViewGroupBy) })
                }
              >
                <SelectTrigger id="work-items-sub-group-by" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions
                    .filter((option) => option.value !== display.groupBy || option.value === 'none')
                    .map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work-items-order-by">{t('display.orderBy', 'Order by')}</Label>
              <Select
                value={display.orderBy}
                onValueChange={(value) => patch({ orderBy: value as SavedViewOrderBy })}
              >
                <SelectTrigger id="work-items-order-by" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t('display.displayProperties', 'Display Properties')}
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                {ALL_SAVED_VIEW_DISPLAY_PROPERTIES.map((property) => (
                  <div key={property} className="flex items-center gap-2">
                    <Checkbox
                      id={`work-items-property-${property}`}
                      checked={display.displayProperties.has(property)}
                      onCheckedChange={() => toggleProperty(property)}
                    />
                    <Label
                      htmlFor={`work-items-property-${property}`}
                      className="text-muted-foreground font-normal"
                    >
                      {t(
                        `display.property.${property}`,
                        SAVED_VIEW_DISPLAY_PROPERTY_LABELS[property],
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="work-items-show-sub-work-items"
                  checked={display.showSubWorkItems}
                  onCheckedChange={(checked) => patch({ showSubWorkItems: checked === true })}
                />
                <Label htmlFor="work-items-show-sub-work-items" className="font-normal">
                  {t('display.showSubWorkItems', 'Show sub-work items')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="work-items-show-empty-groups"
                  checked={display.showEmptyGroups}
                  onCheckedChange={(checked) => patch({ showEmptyGroups: checked === true })}
                />
                <Label htmlFor="work-items-show-empty-groups" className="font-normal">
                  {t('display.showEmptyGroups', 'Show empty groups')}
                </Label>
              </div>
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
