import { Skeleton } from '@/v2/components/ui/skeleton';

/**
 * Suspense fallback for the lazily-loaded v2 pages.
 *
 * v1's `PageFallback` is a line of centred text: dropping it into the v2 shell
 * collapses the page frame to one short row, then the page's own skeleton
 * expands it again, then the data replaces that — three different layouts for
 * one navigation. This holds the page's shape instead, so the chunk landing is
 * a swap rather than a jump.
 */
export function PageFallback() {
  return (
    <div className="space-y-6 pb-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
