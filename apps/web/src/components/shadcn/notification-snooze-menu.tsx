import { useId, useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/shadcn/ui/button';
import { Input } from '@/components/shadcn/ui/input';
import { Label } from '@/components/shadcn/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/ui/popover';
import { Separator } from '@/components/shadcn/ui/separator';

interface NotificationSnoozeMenuProps {
  snoozedUntil: string | null;
  busy?: boolean;
  disabled?: boolean;
  onSnooze: (until: Date) => void | Promise<void>;
  onUnsnooze: () => void | Promise<void>;
}

function inOneHour(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function tomorrowMorning(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function nextWeek(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(9, 0, 0, 0);
  return date;
}

function toLocalDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * V2 notification snooze controls composed from the project's shadcn
 * primitives. The legacy inbox keeps its existing menu while this version gets
 * Radix focus management, Escape handling and a labelled custom date field.
 */
export function NotificationSnoozeMenu({
  snoozedUntil,
  busy = false,
  disabled = false,
  onSnooze,
  onUnsnooze,
}: NotificationSnoozeMenuProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [minimumTime, setMinimumTime] = useState(() => Date.now() + 60 * 1000);
  const controlsDisabled = disabled || busy;

  if (snoozedUntil) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-11 sm:h-8"
        disabled={controlsDisabled}
        onClick={() => void onUnsnooze()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Clock3 />}
        {t('notifications.snooze.wakeUp', 'Wake up')}
      </Button>
    );
  }

  const customDate = customValue ? new Date(customValue) : null;
  const customIsValid = Boolean(
    customDate && !Number.isNaN(customDate.getTime()) && customDate.getTime() > minimumTime,
  );

  const choose = (until: Date) => {
    setOpen(false);
    void onSnooze(until);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setMinimumTime(Date.now() + 60 * 1000);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 sm:h-8"
          disabled={controlsDisabled}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Clock3 />}
          {t('notifications.snooze.snooze', 'Snooze')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="px-2 py-1.5 text-sm font-medium">
          {t('notifications.snooze.snooze', 'Snooze')}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start sm:h-10"
          onClick={() => choose(inOneHour())}
        >
          {t('notifications.snooze.forOneHour', 'For 1 hour')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start sm:h-10"
          onClick={() => choose(tomorrowMorning())}
        >
          {t('notifications.snooze.untilTomorrow', 'Until tomorrow morning')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start sm:h-10"
          onClick={() => choose(nextWeek())}
        >
          {t('notifications.snooze.nextWeek', 'Next week')}
        </Button>
        <Separator className="my-2" />
        <div className="space-y-2 px-2 pb-2">
          <Label htmlFor={inputId}>{t('notifications.snooze.custom', 'Custom')}</Label>
          <Input
            id={inputId}
            type="datetime-local"
            min={toLocalDateTimeValue(new Date(minimumTime))}
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            className="h-11 sm:h-9"
          />
          <Button
            type="button"
            className="h-11 w-full sm:h-9"
            disabled={!customIsValid || controlsDisabled}
            onClick={() => {
              if (customDate && customIsValid) choose(customDate);
            }}
          >
            {t('notifications.snooze.snoozeUntil', 'Snooze until…')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
