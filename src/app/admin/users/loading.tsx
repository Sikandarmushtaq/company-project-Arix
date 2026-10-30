import { SkeletonTable, SkeletonStats } from '@/components/ui/Skeleton';

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-[var(--muted)] rounded animate-pulse" />
          <div className="h-4 w-56 bg-[var(--muted)] rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-[var(--muted)] rounded-lg animate-pulse" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonStats key={i} />
        ))}
      </div>

      {/* Search and filters skeleton */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 max-w-md bg-[var(--muted)] rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-[var(--muted)] rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-[var(--muted)] rounded-lg animate-pulse" />
      </div>

      {/* Table skeleton */}
      <SkeletonTable rows={10} columns={7} />
    </div>
  );
}
