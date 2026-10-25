import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CycleBurndownChartProps {
  /** Map of YYYY-MM-DD -> number of work items completed that day. */
  completionChart: Record<string, number | null>;
  /** Total work items in the cycle (the burndown starts here). */
  total: number;
  startDate?: string | null;
  endDate?: string | null;
}

/** Inclusive list of YYYY-MM-DD strings between two dates (UTC), or [] if invalid. */
function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return out;
  // Cap to a sane span so a misconfigured cycle can't produce a huge series.
  for (let i = 0; i < 366 && s <= e; i++) {
    out.push(s.toISOString().slice(0, 10));
    s.setUTCDate(s.getUTCDate() + 1);
  }
  return out;
}

interface BurndownPoint {
  day: string;
  pending: number | null;
  ideal: number | null;
}

/**
 * A real burndown line chart for a cycle: the actual pending (remaining) work
 * items per day, derived from the per-day completion counts and the cycle
 * total, plotted against an ideal straight line. Handles cycles without dates
 * and empty completion data cleanly.
 */
export function CycleBurndownChart({
  completionChart,
  total,
  startDate,
  endDate,
}: CycleBurndownChartProps) {
  const { t } = useTranslation();
  const data = useMemo<BurndownPoint[]>(() => {
    const start = startDate?.slice(0, 10);
    const end = endDate?.slice(0, 10);
    const ranged = Boolean(start && end);
    const days = ranged
      ? eachDay(start!, end!)
      : Object.keys(completionChart)
          .filter((k) => completionChart[k] != null)
          .sort();
    if (days.length === 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    const lastIdx = days.length - 1;
    let cumulative = 0;
    return days.map((day, i) => {
      cumulative += completionChart[day] ?? 0;
      const remaining = Math.max(0, total - cumulative);
      return {
        day,
        // Only plot the actual line up to (and including) today.
        pending: day <= today ? remaining : null,
        // Ideal line from total -> 0; a single-day cycle (lastIdx === 0) has no
        // slope, so anchor it at 0 to avoid dividing by zero.
        ideal: ranged
          ? lastIdx > 0
            ? Math.round(((total * (lastIdx - i)) / lastIdx) * 10) / 10
            : 0
          : null,
      };
    });
  }, [completionChart, total, startDate, endDate]);

  if (data.length === 0) {
    return (
      <p className="text-xs text-(--txt-tertiary)">
        {t(
          'cycles.burndown.needDates',
          'Add start and due dates to the cycle to see the burndown.',
        )}
      </p>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: 'var(--txt-tertiary)' }}
            tickLine={{ stroke: 'var(--border-subtle)' }}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tick={{ fontSize: 10, fill: 'var(--txt-tertiary)' }}
            tickLine={{ stroke: 'var(--border-subtle)' }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--txt-secondary)' }}
          />
          <Line
            type="linear"
            dataKey="ideal"
            name="Ideal"
            stroke="var(--txt-tertiary)"
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="pending"
            name="Pending"
            stroke="var(--brand-default)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
