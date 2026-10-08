import { Skeleton } from "@/components/ui/skeleton";

export default function ScheduleELoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 rounded-xl border bg-surface p-4 sm:grid-cols-3 md:p-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-surface p-4 md:p-5">
          <Skeleton className="h-5 w-48" />
          {[0, 1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}
