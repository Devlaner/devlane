import { Skeleton } from '@/v2/components/ui/skeleton';

interface ListPageSkeletonProps {
  /** Names what is loading, announced while the placeholder is up. */
  label: string;
  /** How many table rows to stand in for. */
  rows?: number;
}

/**
 * The placeholder the v2 list pages share. It is shaped like the page it
 * replaces — heading, toolbar, then table rows — so the layout does not jump
 * when the data lands.
 */
export function ListPageSkeleton({ label, rows = 8 }: ListPageSkeletonProps) {
  return (
    <div className="space-y-6 pb-8" aria-busy="true" aria-label={label}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="overflow-hidden rounded-xl border">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex h-12 items-center gap-3 border-t px-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 max-w-80 flex-1" />
            <Skeleton className="hidden h-5 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
