import * as React from 'react';

import { cn } from '@/lib/utils';

interface CircularProgressProps extends Omit<React.ComponentProps<'div'>, 'role'> {
  /** Completion, 0–100. Values outside the range are clamped. */
  value: number;
  /** Outer diameter in pixels. */
  size?: number;
  /** Ring thickness in pixels. */
  strokeWidth?: number;
  /** Prints the rounded percentage in the middle of the ring. */
  showValue?: boolean;
}

/**
 * A ring-shaped progress indicator.
 *
 * shadcn/ui ships only the linear `Progress`, so this is the same idea drawn as
 * a circle: a track plus an arc scaled by `value`, both painted from the theme
 * tokens rather than fixed colours. It is used where a percentage has to read
 * at a glance next to a name — a cycle row, a cycle's header — and a full-width
 * bar would take more room than the number is worth.
 */
function CircularProgress({
  value,
  size = 40,
  strokeWidth = 3,
  showValue = true,
  className,
  ...props
}: CircularProgressProps) {
  const percent = Math.round(Math.max(0, Math.min(100, value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      data-slot="circular-progress"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (percent / 100) * circumference}
          className="stroke-primary transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      {showValue && (
        <span
          className="text-muted-foreground absolute font-medium tabular-nums"
          style={{ fontSize: Math.max(9, Math.round(size * 0.26)) }}
        >
          {percent}%
        </span>
      )}
    </div>
  );
}

export { CircularProgress };
