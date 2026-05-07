import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '../ui';

interface Props {
  /** Already snoozed? Show "Wake up" instead of presets. */
  snoozedUntil: string | null;
  onSnooze: (until: Date) => void | Promise<void>;
  onUnsnooze: () => void | Promise<void>;
}

function inOneHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d;
}

function tomorrowMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function nextWeek() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Snooze presets and a custom date input. Mounted next to other notification
 * actions in the detail pane. The custom input uses a native `datetime-local`
 * to keep the dependency surface small — accessibility comes for free.
 */
export function SnoozeMenu({ snoozedUntil, onSnooze, onUnsnooze }: Props) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (snoozedUntil) {
    return (
      <Button size="sm" variant="secondary" onClick={() => onUnsnooze()}>
        <Clock size={14} /> Wake up
      </Button>
    );
  }

  const choose = (until: Date) => {
    setOpen(false);
    void onSnooze(until);
  };

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
        <Clock size={14} /> Snooze
      </Button>
      {open ? (
        <div className="absolute right-0 z-(--z-modal) mt-1 w-56 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            onClick={() => choose(inOneHour())}
          >
            For 1 hour
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            onClick={() => choose(tomorrowMorning())}
          >
            Until tomorrow morning
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            onClick={() => choose(nextWeek())}
          >
            Next week
          </button>
          <div className="my-1 h-px bg-(--border-subtle)" />
          <div className="px-3 py-2">
            <label htmlFor="snooze-custom-time" className="block text-xs text-(--txt-tertiary)">
              Custom
            </label>
            <input
              id="snooze-custom-time"
              type="datetime-local"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="mt-1 w-full rounded border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-sm text-(--txt-primary)"
            />
            <button
              type="button"
              disabled={!customValue}
              onClick={() => {
                const d = new Date(customValue);
                if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
                  choose(d);
                }
              }}
              className="mt-1 w-full rounded bg-(--brand-default) px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Snooze until…
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
