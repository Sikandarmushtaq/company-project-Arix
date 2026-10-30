'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--muted)] rounded ${className}`} />;
}

function StatsCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="w-16 h-8" />
          <Skeleton className="w-24 h-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function ServerCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="w-32 h-4" />
              <Skeleton className="w-24 h-3" />
            </div>
          </div>
          <Skeleton className="w-16 h-6 rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Skeleton className="w-16 h-4" />
          <Skeleton className="w-12 h-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function HAMonitorLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="w-64 h-8" />
          <Skeleton className="w-96 h-4" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="w-20 h-10 rounded-md" />
          <Skeleton className="w-24 h-10 rounded-md" />
          <Skeleton className="w-36 h-10 rounded-md" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Topology skeleton */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <Skeleton className="w-40 h-6" />
          </CardHeader>
          <CardContent className="p-4">
            <Skeleton className="w-full h-[500px]" />
          </CardContent>
        </Card>

        {/* Sidebar skeleton */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="w-32 h-5" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="w-full h-16" />
              <Skeleton className="w-full h-16" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="w-40 h-5" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-full h-32" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Server cards skeleton */}
      <div>
        <Skeleton className="w-48 h-6 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
        </div>
      </div>
    </div>
  );
}
