import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyzeLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border bg-surface p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-4 rounded-xl border bg-surface p-4 md:p-5">
              <Skeleton className="h-5 w-32" />
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border bg-surface p-4 md:p-5">
          <Skeleton className="h-5 w-36" />
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
