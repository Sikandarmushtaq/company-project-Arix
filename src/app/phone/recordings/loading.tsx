import { SkeletonTable, Skeleton } from '@/components/ui/Skeleton';

export default function RecordingsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-[var(--muted)] rounded animate-pulse" />
          <div className="h-4 w-56 bg-[var(--muted)] rounded animate-pulse" />
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Table skeleton */}
      <SkeletonTable rows={10} columns={5} />

      {/* Pagination skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-10 w-80" />
      </div>
    </div>
  );
}
