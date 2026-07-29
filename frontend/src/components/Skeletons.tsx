import { Skeleton } from '@/components/ui/skeleton';

export function StatTileSkeleton() {
  return (
    <div className="rounded-card border border-line bg-card p-5 shadow-sm">
      <Skeleton className="size-10 rounded-tile" />
      <Skeleton className="mt-4 h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-20" />
    </div>
  );
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatTileSkeleton key={i} />
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-card border border-line bg-card p-5 shadow-sm">
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-card border border-line bg-card p-5 shadow-sm">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 rounded-card border border-line bg-card p-4">
          <Skeleton className="size-10 rounded-tile" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line bg-card p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
