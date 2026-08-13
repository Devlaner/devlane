import { Skeleton } from '@/components/shadcn/ui/skeleton';

interface DetailPageSkeletonProps {
  /** Names what is loading, announced while the placeholder is up. */
  label: string;
  /** How many rows the main column stands in for. */
  rows?: number;
}

/**
 * The placeholder the v2 detail pages share. It mirrors ListPageSkeleton — the
 * same heading and toolbar band — and then splits into the two-column body the
 * detail pages use, so moving from a list to a detail page keeps the same
 * frame while the record loads.
 */
export function DetailPageSkeleton({ label, rows = 3 }: DetailPageSkeletonProps) {
  return (
    <div className="space-y-6 pb-8" aria-busy="true" aria-label={label}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="h-4 w-40 max-w-full" />
      </div>

      <Skeleton className="h-16 w-full rounded-xl" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
