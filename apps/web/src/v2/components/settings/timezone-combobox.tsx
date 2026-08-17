import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/v2/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/v2/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/v2/components/ui/popover';
import { getTimezoneOptions } from '../../../lib/settingsHelpers';

interface TimezoneComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Searchable timezone picker. The list runs to hundreds of entries, so it is a
 * command palette rather than a plain select.
 */
export function TimezoneCombobox({ id, value, onChange, className }: TimezoneComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => getTimezoneOptions(), []);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">{selected?.label ?? value}</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t('common.search', 'Search')} />
          <CommandList>
            <CommandEmpty>{t('settings.timezone.empty', 'No timezone found.')}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <CheckIcon
                  className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
