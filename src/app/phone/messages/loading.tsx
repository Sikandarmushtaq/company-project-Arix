import { SkeletonListItem, SkeletonMessage, Skeleton } from '@/components/ui/Skeleton';

export default function MessagesLoading() {
  return (
    <div className="h-full flex">
      {/* Conversation list */}
      <div className="w-80 border-r border-[var(--border)] flex flex-col">
        {/* Search skeleton */}
        <div className="p-4 border-b border-[var(--border)]">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* Conversations skeleton */}
        <div className="flex-1 overflow-hidden">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <SkeletonListItem key={i} />
          ))}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col">
        {/* Thread header skeleton */}
        <div className="h-16 px-4 border-b border-[var(--border)] flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Messages skeleton */}
        <div className="flex-1 p-4 space-y-4 overflow-hidden">
          <SkeletonMessage />
          <SkeletonMessage isOwn />
          <SkeletonMessage />
          <SkeletonMessage isOwn />
          <SkeletonMessage />
        </div>

        {/* Input skeleton */}
        <div className="p-4 border-t border-[var(--border)]">
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
