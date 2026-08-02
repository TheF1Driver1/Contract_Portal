import { Skeleton } from "@/components/ui/skeleton";

export default function ContractDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="surface-card p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-36" />
                </div>
              ))}
            </div>
          </div>
          <div className="surface-card p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="surface-card p-6 space-y-3">
            <Skeleton className="h-5 w-24" />
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
          <div className="surface-card p-6 space-y-3">
            <Skeleton className="h-5 w-28" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
