import type { ReactNode } from 'react';
import { FILTER_ICONS } from './WorkspaceViewsFiltersData';

/** Plane-style filter row: small square checkbox or round radio, optional leading icon, label. */
export function FiltersPanelOptionRow({
  checked,
  onToggle,
  icon,
  label,
  radio = false,
}: {
  checked: boolean;
  onToggle: () => void;
  icon?: ReactNode;
  label: ReactNode;
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left hover:bg-(--bg-layer-1-hover)"
    >
      <span
        className={`grid size-3 shrink-0 place-items-center border ${
          checked
            ? 'border-(--brand-default) bg-(--brand-default) text-white'
            : 'border-(--border-strong)'
        } ${radio ? 'rounded-full' : 'rounded-[3px]'}`}
        aria-hidden
      >
        {checked && !radio ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
        {checked && radio ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        {icon ? <span className="grid w-5 shrink-0 place-items-center">{icon}</span> : null}
        <span className="truncate text-sm text-(--txt-primary)">{label}</span>
      </span>
    </button>
  );
}

export interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  titleClassName?: string;
}

export function CollapsibleSection({
  title,
  open: controlledOpen,
  onToggle,
  children,
  titleClassName,
}: CollapsibleSectionProps) {
  return (
    <div className="border-b border-(--border-subtle) last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-(--bg-layer-1-hover)"
      >
        <span className={`text-sm font-medium ${titleClassName ?? 'text-(--txt-primary)'}`}>{title}</span>
        <span className="text-(--txt-icon-tertiary)">
          {controlledOpen ? <FILTER_ICONS.chevronUp /> : <FILTER_ICONS.chevronDown />}
        </span>
      </button>
      {controlledOpen && <div className="pb-1">{children}</div>}
    </div>
  );
}
