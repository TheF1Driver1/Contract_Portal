import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-xl border bg-surface p-4 md:p-5">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function ContractDetailLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-4">
        <Skeleton className="h-8 w-24" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="size-9" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSkeleton rows={6} />
          <CardSkeleton rows={5} />
          <CardSkeleton rows={3} />
        </div>
        <div className="space-y-6">
          <div className="space-y-3 rounded-xl border bg-surface p-4 md:p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
          <CardSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
