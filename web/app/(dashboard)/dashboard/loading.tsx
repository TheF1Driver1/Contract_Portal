import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36 sm:h-9" />
      </div>

      {/* Hoy queue */}
      <div className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <Skeleton className="mb-4 h-5 w-16" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="h-10 w-20 sm:h-8" />
            </div>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border bg-surface p-4 md:p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="rounded-xl border border-border bg-surface p-4 md:p-5 lg:col-span-2">
          <Skeleton className="mb-2 h-5 w-48" />
          <Skeleton className="mb-4 h-4 w-72 max-w-full" />
          <Skeleton className="h-64 w-full" />
        </div>

        {/* Recent contracts */}
        <div className="rounded-xl border border-border bg-surface p-4 md:p-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
