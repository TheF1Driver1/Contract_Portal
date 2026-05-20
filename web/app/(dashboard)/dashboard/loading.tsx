import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="surface-card p-5 space-y-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="surface-card p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
        <div className="surface-card p-6 lg:col-span-2 space-y-3">
          <Skeleton className="h-5 w-40" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="surface-card p-6">
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  );
}
