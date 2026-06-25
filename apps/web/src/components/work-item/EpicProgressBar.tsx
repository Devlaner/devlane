import type { EpicProgress } from '../../services/epicService';

/**
 * Compact completion bar for an epic: a fill proportional to completed/total
 * child work items, plus a count label. Renders a neutral "No items" state when
 * the epic has no children.
 */
export function EpicProgressBar({ progress }: { progress?: EpicProgress }) {
  const total = progress?.total ?? 0;
  const done = progress?.completed ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2" title={`${done} of ${total} completed`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-(--border-subtle)">
        <div
          className="h-full rounded-full bg-(--bg-accent-primary)"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] text-(--txt-tertiary)">
        {total === 0 ? 'No items' : `${done}/${total}`}
      </span>
    </div>
  );
}
