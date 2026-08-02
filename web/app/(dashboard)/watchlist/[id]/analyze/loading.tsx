import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyzeLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 rounded-xl" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="surface-card p-6 space-y-3">
            <Skeleton className="h-5 w-28" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
