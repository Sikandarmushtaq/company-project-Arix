import { Skeleton } from '@/components/ui/Skeleton';

export default function PermissionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Search and filters skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Permissions table skeleton */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        {/* Table header */}
        <div className="border-b border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex-1 flex gap-4 justify-end">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-4 w-20" />
              ))}
            </div>
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-[var(--border)]">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex-1 flex gap-4 justify-end">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <Skeleton key={j} className="h-5 w-5 rounded" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
