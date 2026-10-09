import React from 'react';

/** Square loading placeholder that matches the final layout's shape. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} aria-hidden="true" />
);

export const TicketCardSkeleton: React.FC = () => (
  <div className="rounded-card border border-line bg-surface p-4 shadow-card">
    <div className="flex items-center gap-2">
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="ml-auto h-4 w-16" />
    </div>
    <Skeleton className="mt-4 h-5 w-3/4" />
    <Skeleton className="mt-2 h-4 w-1/2" />
    <Skeleton className="mt-4 h-24 w-full rounded-lg" />
  </div>
);

/** A list of ticket-shaped skeletons while data loads. */
export const TicketListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid gap-4" aria-busy="true" aria-label="Loading issues">
    {Array.from({ length: count }).map((_, i) => (
      <TicketCardSkeleton key={i} />
    ))}
  </div>
);
