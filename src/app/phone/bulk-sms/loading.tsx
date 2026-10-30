import { SkeletonStats } from '@/components/ui/Skeleton';

export default function BulkSmsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-[var(--muted)] rounded animate-pulse" />
          <div className="h-4 w-56 bg-[var(--muted)] rounded animate-pulse" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonStats key={i} />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Import card */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <div className="h-5 w-24 bg-[var(--muted)] rounded animate-pulse mb-4" />
            <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 flex flex-col items-center">
              <div className="w-8 h-8 bg-[var(--muted)] rounded animate-pulse mb-3" />
              <div className="h-4 w-48 bg-[var(--muted)] rounded animate-pulse mb-2" />
              <div className="h-3 w-32 bg-[var(--muted)] rounded animate-pulse" />
            </div>
          </div>
          {/* Message card */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <div className="h-5 w-20 bg-[var(--muted)] rounded animate-pulse mb-4" />
            <div className="h-28 bg-[var(--muted)] rounded-lg animate-pulse" />
          </div>
          {/* Button */}
          <div className="h-11 bg-[var(--muted)] rounded-lg animate-pulse" />
        </div>

        {/* Right column */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="h-5 w-28 bg-[var(--muted)] rounded animate-pulse mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)]"
              >
                <div className="w-4 h-4 bg-[var(--muted)] rounded animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 bg-[var(--muted)] rounded animate-pulse" />
                  <div className="h-3 w-20 bg-[var(--muted)] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
