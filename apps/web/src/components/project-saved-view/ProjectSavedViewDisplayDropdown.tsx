import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type SavedViewDisplayPropertyId,
  type SavedViewGroupBy,
  type SavedViewOrderBy,
  type SavedViewOrderDirection,
  ALL_SAVED_VIEW_DISPLAY_PROPERTIES,
  SAVED_VIEW_DISPLAY_PROPERTY_LABELS,
} from '../../lib/projectSavedViewDisplay';
import { useProjectSavedViewDisplay } from '../../contexts/ProjectSavedViewDisplayContext';
import { Button } from '../ui';

const IconChevronDown = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const IconSliders = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

type SectionId = 'properties' | 'group' | 'order';

function CollapsibleSection(props: {
  id: SectionId;
  title: string;
  expanded: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
}) {
  const { id, title, expanded, onToggle, children } = props;
  return (
    <div className="border-b border-(--border-subtle) last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-amber-800/90 dark:text-amber-200/90"
      >
        <span>{title}</span>
        <span
          className={`text-(--txt-icon-tertiary) transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <IconChevronDown />
        </span>
      </button>
      {expanded ? <div className="px-2 pb-2">{children}</div> : null}
    </div>
  );
}

function RadioRow<T extends string>(props: {
  selected: boolean;
  value: T;
  label: string;
  onSelect: (v: T) => void;
}) {
  const { selected, value, label, onSelect } = props;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover) ${selected ? 'bg-(--bg-layer-1-hover)' : ''}`}
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
          selected
            ? 'border-(--brand-default) bg-(--brand-default) text-white'
            : 'border-(--border-strong)'
        }`}
      >
        {selected ? <IconCheck /> : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function ProjectSavedViewDisplayDropdown() {
  const { t } = useTranslation();
  const { settings, setSettings } = useProjectSavedViewDisplay();
  const GROUP_OPTIONS: { value: SavedViewGroupBy; label: string }[] = [
    { value: 'states', label: t('header.display.groupBy.states', 'States') },
    { value: 'priority', label: t('header.display.groupBy.priority', 'Priority') },
    { value: 'cycle', label: t('header.display.groupBy.cycle', 'Cycle') },
    { value: 'module', label: t('header.display.groupBy.module', 'Module') },
    { value: 'labels', label: t('header.display.groupBy.labels', 'Labels') },
    { value: 'assignees', label: t('header.display.groupBy.assignees', 'Assignees') },
    { value: 'created_by', label: t('header.display.groupBy.createdBy', 'Created by') },
    { value: 'none', label: t('common.none', 'None') },
  ];
  const ORDER_OPTIONS: { value: SavedViewOrderBy; label: string }[] = [
    { value: 'manual', label: t('common.manual', 'Manual') },
    { value: 'last_created', label: t('header.display.orderBy.lastCreated', 'Last created') },
    { value: 'last_updated', label: t('header.display.orderBy.lastUpdated', 'Last updated') },
    { value: 'start_date', label: t('common.startDate', 'Start date') },
    { value: 'due_date', label: t('common.dueDate', 'Due date') },
    { value: 'priority', label: t('header.display.orderBy.priority', 'Priority') },
  ];
  const DIRECTION_OPTIONS: { value: SavedViewOrderDirection; label: string }[] = [
    { value: 'asc', label: t('common.ascending', 'Ascending') },
    { value: 'desc', label: t('common.descending', 'Descending') },
  ];
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<Record<SectionId, boolean>>({
    properties: true,
    group: true,
    order: true,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggleProperty = (id: SavedViewDisplayPropertyId) => {
    setSettings((prev) => {
      const next = new Set(prev.displayProperties);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, displayProperties: next };
    });
  };

  const toggleSection = (id: SectionId) => {
    setSections((s) => ({ ...s, [id]: !s[id] }));
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5 border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="shrink-0 text-(--txt-icon-tertiary)">
          <IconSliders />
        </span>
        {t('header.display', 'Display')}
        <IconChevronDown />
      </Button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1.5 w-[min(340px,calc(100vw-24px))] rounded-lg border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
          role="menu"
        >
          <div className="max-h-[min(70vh,560px)] overflow-y-auto py-1">
            <CollapsibleSection
              id="properties"
              title={t('header.display.properties', 'Display properties')}
              expanded={sections.properties}
              onToggle={toggleSection}
            >
              <div className="flex flex-wrap gap-1.5">
                {ALL_SAVED_VIEW_DISPLAY_PROPERTIES.map((prop) => {
                  const on = settings.displayProperties.has(prop);
                  return (
                    <button
                      key={prop}
                      type="button"
                      onClick={() => toggleProperty(prop)}
                      className={`rounded-md border px-2 py-1 text-[12px] font-medium transition-colors ${
                        on
                          ? 'border-(--brand-default) bg-(--brand-default) text-white'
                          : 'border-(--border-subtle) bg-(--bg-layer-1) text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
                      }`}
                    >
                      {t(`display.property.${prop}`, SAVED_VIEW_DISPLAY_PROPERTY_LABELS[prop])}
                    </button>
                  );
                })}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="group"
              title={t('header.display.groupByTitle', 'Group by')}
              expanded={sections.group}
              onToggle={toggleSection}
            >
              <div className="flex flex-col gap-0.5">
                {GROUP_OPTIONS.map((opt) => (
                  <RadioRow
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    selected={settings.groupBy === opt.value}
                    onSelect={(v) => setSettings((p) => ({ ...p, groupBy: v }))}
                  />
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="order"
              title={t('header.display.orderByTitle', 'Order by')}
              expanded={sections.order}
              onToggle={toggleSection}
            >
              <div className="flex flex-col gap-0.5">
                {ORDER_OPTIONS.map((opt) => (
                  <RadioRow
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    selected={settings.orderBy === opt.value}
                    onSelect={(v) => setSettings((p) => ({ ...p, orderBy: v }))}
                  />
                ))}
              </div>
              <div
                className="mx-2 mt-2 flex items-center gap-1"
                role="group"
                aria-label={t('header.display.orderDirection', 'Order direction')}
              >
                {DIRECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={settings.orderDirection === opt.value}
                    onClick={() => setSettings((p) => ({ ...p, orderDirection: opt.value }))}
                    className={
                      settings.orderDirection === opt.value
                        ? 'flex-1 rounded-(--radius-md) bg-(--bg-layer-1-hover) px-2 py-1 text-[13px] text-(--txt-primary)'
                        : 'flex-1 rounded-(--radius-md) px-2 py-1 text-[13px] text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mx-2 my-2 border-t border-(--border-subtle)" />
              <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-(--border-strong)"
                  checked={settings.showSubWorkItems}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      showSubWorkItems: e.target.checked,
                    }))
                  }
                />
                {t('header.display.showSubWorkItems', 'Show sub-work items')}
              </label>
            </CollapsibleSection>
          </div>
        </div>
      ) : null}
    </div>
  );
}
