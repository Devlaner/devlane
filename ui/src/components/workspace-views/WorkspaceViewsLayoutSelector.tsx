import { useWorkspaceViewsState } from "../../contexts/WorkspaceViewsStateContext";
import {
  VIEW_LAYOUTS,
  VIEW_LAYOUT_LABELS,
  type ViewLayout,
} from "../../types/workspaceViewDisplay";

const IconList = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconLayoutGrid = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);
const IconColumns = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
);
const IconCalendar = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconGantt = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <path d="M3 6v12" />
    <path d="M3 12h6" />
    <path d="M3 18h4" />
    <path d="M13 8h8" />
    <path d="M13 12h5" />
    <path d="M13 16h6" />
  </svg>
);

const LAYOUT_ICONS: Record<
  ViewLayout,
  React.ComponentType<React.SVGAttributes<SVGSVGElement>>
> = {
  list: IconList,
  kanban: IconColumns,
  calendar: IconCalendar,
  spreadsheet: IconLayoutGrid,
  gantt_chart: IconGantt,
};

export function WorkspaceViewsLayoutSelector() {
  const { display, setDisplay } = useWorkspaceViewsState();
  const layout = display.layout;

  const setLayout = (newLayout: ViewLayout) => {
    setDisplay((prev) => ({ ...prev, layout: newLayout }));
  };

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-1) p-0.5">
      {VIEW_LAYOUTS.map((l) => {
        const Icon = LAYOUT_ICONS[l];
        const isActive = layout === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLayout(l)}
            title={VIEW_LAYOUT_LABELS[l]}
            className={`flex size-8 items-center justify-center rounded transition-colors ${
              isActive
                ? "bg-(--bg-layer-2) text-(--txt-primary)"
                : "text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2) hover:text-(--txt-secondary)"
            }`}
            aria-pressed={isActive}
            aria-label={VIEW_LAYOUT_LABELS[l]}
          >
            {Icon && <Icon className="size-4" />}
          </button>
        );
      })}
    </div>
  );
}
