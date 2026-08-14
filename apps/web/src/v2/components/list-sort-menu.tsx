import { useTranslation } from 'react-i18next';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowUpDown } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import type { SortOrder, SortState } from '../lib/listControls';

export interface ListSortOption<T extends string> {
  value: T;
  label: string;
}

interface ListSortMenuProps<T extends string> {
  options: ListSortOption<T>[];
  value: SortState<T>;
  onChange: (next: SortState<T>) => void;
}

/**
 * The sort control the v2 project lists share — a field to sort on plus the
 * direction, in one menu.
 *
 * It is a dropdown rather than the filters popover: the choice is single-value
 * and closing on pick is the whole interaction, which is what DropdownMenu's
 * radio items already do.
 */
export function ListSortMenu<T extends string>({ options, value, onChange }: ListSortMenuProps<T>) {
  const { t } = useTranslation();
  const current = options.find((option) => option.value === value.sortBy);
  const OrderIcon = value.sortOrder === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  const setOrder = (sortOrder: SortOrder) => onChange({ ...value, sortOrder });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="h-11 sm:h-9">
          <ArrowUpDown aria-hidden="true" />
          <span className="max-w-32 truncate">
            {current?.label ?? t('common.sortBy', 'Sort by')}
          </span>
          {/* The direction rides on the trigger so the current order is legible
              without opening the menu. */}
          <OrderIcon className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={8} className="w-52">
        <DropdownMenuLabel>{t('common.sortBy', 'Sort by')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value.sortBy}
          onValueChange={(next) => onChange({ ...value, sortBy: next as T })}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* Kept as plain items so picking a direction reads as an action on the
            field above it rather than a second, competing choice. */}
        <DropdownMenuItem onSelect={() => setOrder('asc')}>
          <ArrowUpNarrowWide aria-hidden="true" />
          {t('common.ascending', 'Ascending')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOrder('desc')}>
          <ArrowDownWideNarrow aria-hidden="true" />
          {t('common.descending', 'Descending')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
