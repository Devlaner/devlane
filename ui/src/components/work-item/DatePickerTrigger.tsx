import { useRef } from 'react';

export function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!m || !d) return isoDate;
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  return `${month}/${day}/${y}`;
}

export interface DatePickerTriggerProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
}

export function DatePickerTrigger({
  label,
  icon,
  value,
  onChange,
  placeholder,
  compact: _compact = true,
}: DatePickerTriggerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = value ? formatDateForDisplay(value) : '';

  return (
    <div className="relative inline-flex min-w-0 shrink-0 items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-1.5 py-1 text-xs text-[var(--txt-secondary)] [&_svg]:size-3">
      <span className="shrink-0 text-[var(--txt-icon-tertiary)]">{icon}</span>
      <span className="truncate">{displayValue || placeholder}</span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => inputRef.current?.showPicker?.()}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      />
    </div>
  );
}
