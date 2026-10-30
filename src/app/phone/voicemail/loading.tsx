import { Skeleton } from '@/components/ui/Skeleton';

export default function VoicemailLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-[var(--muted)] rounded animate-pulse" />
          <div className="h-4 w-48 bg-[var(--muted)] rounded animate-pulse" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Voicemail list skeleton */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b border-[var(--border)] last:border-0"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
