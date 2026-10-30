import { SkeletonTable, SkeletonStats } from '@/components/ui/Skeleton';

export default function HistoryLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-[var(--muted)] rounded animate-pulse" />
          <div className="h-4 w-64 bg-[var(--muted)] rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-[var(--muted)] rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-[var(--muted)] rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonStats key={i} />
        ))}
      </div>

      {/* Table skeleton */}
      <SkeletonTable rows={10} columns={6} />
    </div>
  );
}
