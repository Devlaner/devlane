import { type ReactNode, useState } from 'react';
import type { SavedViewGroupBy, SavedViewOrderBy } from '../../lib/projectSavedViewDisplay';
import {
  ALL_SAVED_VIEW_DISPLAY_PROPERTIES,
  SAVED_VIEW_DISPLAY_PROPERTY_LABELS,
} from '../../lib/projectSavedViewDisplay';
import type { ProjectIssuesDisplayState } from '../../lib/projectIssuesDisplay';

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

const IconChevronUp = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m18 15-6-6-6 6" />
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

/** Order matches the work-items Display reference. */
const GROUP_OPTIONS: { value: SavedViewGroupBy; label: string }[] = [
  { value: 'states', label: 'States' },
  { value: 'priority', label: 'Priority' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'module', label: 'Module' },
  { value: 'labels', label: 'Labels' },
  { value: 'assignees', label: 'Assignees' },
  { value: 'created_by', label: 'Created by' },
  { value: 'none', label: 'None' },
];

const ORDER_OPTIONS: { value: SavedViewOrderBy; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'last_created', label: 'Last created' },
  { value: 'last_updated', label: 'Last updated' },
  { value: 'start_date', label: 'Start date' },
  { value: 'due_date', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
];

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
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400"
      >
        <span>{title}</span>
        <span className="text-(--txt-icon-tertiary)">
          {expanded ? <IconChevronUp /> : <IconChevronDown />}
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
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover) ${selected ? 'bg-(--bg-layer-1-hover)' : ''}`}
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
          selected
            ? 'border-(--brand-default) bg-(--brand-default) text-white'
            : 'border-(--border-strong)'
        }`}
        aria-hidden
      >
        {selected ? <IconCheck /> : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

const displayPanelCheckboxClass =
  'size-4 shrink-0 cursor-pointer rounded border-2 border-(--border-subtle) bg-(--bg-canvas) accent-(--brand-default) checked:border-(--brand-default) checked:bg-(--brand-default) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-default)/35 focus-visible:ring-offset-1 focus-visible:ring-offset-(--bg-surface-1)';

export interface ProjectIssuesDisplayPanelProps {
  display: ProjectIssuesDisplayState;
  setDisplay: React.Dispatch<React.SetStateAction<ProjectIssuesDisplayState>>;
}

export function ProjectIssuesDisplayPanel({ display, setDisplay }: ProjectIssuesDisplayPanelProps) {
  const [sections, setSections] = useState<Record<SectionId, boolean>>({
    properties: true,
    group: true,
    order: true,
  });

  const toggleSection = (id: SectionId) => {
    setSections((s) => ({ ...s, [id]: !s[id] }));
  };

  const toggleProperty = (id: (typeof ALL_SAVED_VIEW_DISPLAY_PROPERTIES)[number]) => {
    setDisplay((prev) => {
      const next = new Set(prev.displayProperties);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, displayProperties: next };
    });
  };

  return (
    <div className="flex w-[min(280px,calc(100vw-24px))] max-w-[calc(100vw-24px)] max-h-[min(45dvh,380px)] flex-col overflow-hidden bg-(--bg-surface-1)">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        <CollapsibleSection
          id="properties"
          title="Display Properties"
          expanded={sections.properties}
          onToggle={toggleSection}
        >
          <div className="flex max-w-full flex-wrap gap-1.5">
            {ALL_SAVED_VIEW_DISPLAY_PROPERTIES.map((prop) => {
              const on = display.displayProperties.has(prop);
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
                  {SAVED_VIEW_DISPLAY_PROPERTY_LABELS[prop]}
                </button>
              );
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="group"
          title="Group by"
          expanded={sections.group}
          onToggle={toggleSection}
        >
          <div className="flex flex-col gap-0.5">
            {GROUP_OPTIONS.map((opt) => (
              <RadioRow
                key={opt.value}
                value={opt.value}
                label={opt.label}
                selected={display.groupBy === opt.value}
                onSelect={(v) => setDisplay((p) => ({ ...p, groupBy: v }))}
              />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="order"
          title="Order by"
          expanded={sections.order}
          onToggle={toggleSection}
        >
          <div className="flex flex-col gap-0.5">
            {ORDER_OPTIONS.map((opt) => (
              <RadioRow
                key={opt.value}
                value={opt.value}
                label={opt.label}
                selected={display.orderBy === opt.value}
                onSelect={(v) => setDisplay((p) => ({ ...p, orderBy: v }))}
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      <div className="shrink-0 border-t border-(--border-subtle) bg-(--bg-surface-1) px-2 py-2">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
          <input
            type="checkbox"
            className={displayPanelCheckboxClass}
            checked={display.showSubWorkItems}
            onChange={(e) =>
              setDisplay((p) => ({
                ...p,
                showSubWorkItems: e.target.checked,
              }))
            }
          />
          Show sub-work items
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
          <input
            type="checkbox"
            className={displayPanelCheckboxClass}
            checked={display.showEmptyGroups}
            onChange={(e) =>
              setDisplay((p) => ({
                ...p,
                showEmptyGroups: e.target.checked,
              }))
            }
          />
          Show empty groups
        </label>
      </div>
    </div>
  );
}
