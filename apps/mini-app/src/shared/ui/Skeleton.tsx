import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-xl bg-tg-secondary',
        className,
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-surface-elevated shadow-card rounded-2xl p-4">
      <Skeleton className="h-4 w-1/3 mb-3" />
      <Skeleton className="h-3 w-2/3 mb-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-elevated shadow-card rounded-2xl p-4">
          <Skeleton className="h-6 w-16 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-elevated shadow-card rounded-2xl p-4 flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-5 animate-fade-in">
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-5" />
      <StatGridSkeleton />
      <div className="mt-5">
        <ListSkeleton count={3} />
      </div>
    </div>
  );
}
