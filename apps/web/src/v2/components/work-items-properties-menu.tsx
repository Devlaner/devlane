import { useTranslation } from 'react-i18next';
import { Settings2 } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import {
  DISPLAY_PROPERTY_KEYS,
  DISPLAY_PROPERTY_LABELS,
  type DisplayPropertyKey,
} from '../../types/workspaceViewDisplay';

/** The compact list has no room for the count columns the spreadsheet shows. */
const LIST_DISPLAY_PROPERTY_KEYS: DisplayPropertyKey[] = [
  'id',
  'state',
  'priority',
  'assignee',
  'labels',
  'cycle',
  'module',
  'start_date',
  'due_date',
];

export interface WorkItemsPropertiesMenuProps {
  properties: DisplayPropertyKey[];
  onChange: (next: DisplayPropertyKey[]) => void;
  showSubWorkItems: boolean;
  onShowSubWorkItemsChange: (next: boolean) => void;
  /** Which set of properties to offer; the list drops the count columns. */
  variant: 'list' | 'full';
  /** Properties this surface cannot vary, e.g. the cycle column on a cycle. */
  hiddenProperties?: DisplayPropertyKey[];
}

/**
 * The Display menu: which columns the work-item table shows, and whether
 * sub-work items are rows of their own.
 *
 * Shared by the workspace views toolbar and the cycle page so that "Display"
 * offers the same properties, in the same order, wherever the table appears.
 */
export function WorkItemsPropertiesMenu({
  properties,
  onChange,
  showSubWorkItems,
  onShowSubWorkItemsChange,
  variant,
  hiddenProperties = [],
}: WorkItemsPropertiesMenuProps) {
  const { t } = useTranslation();

  const keys = (variant === 'list' ? LIST_DISPLAY_PROPERTY_KEYS : DISPLAY_PROPERTY_KEYS).filter(
    (key) => !hiddenProperties.includes(key),
  );

  const toggle = (key: DisplayPropertyKey) =>
    onChange(properties.includes(key) ? properties.filter((k) => k !== key) : [...properties, key]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="h-11 shrink-0 justify-between sm:h-9">
          <Settings2 aria-hidden="true" />
          {t('common.display', 'Display')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-56 overflow-y-auto">
        <DropdownMenuLabel>{t('views.displayProperties', 'Display Properties')}</DropdownMenuLabel>
        {keys.map((key) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={properties.includes(key)}
            onCheckedChange={() => toggle(key)}
          >
            {t(`display.property.${key}`, DISPLAY_PROPERTY_LABELS[key])}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showSubWorkItems}
          onCheckedChange={(checked) => onShowSubWorkItemsChange(checked)}
        >
          {t('views.showSubWorkItems', 'Show sub-work items')}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
