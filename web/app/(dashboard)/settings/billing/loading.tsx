import { Skeleton } from "@/components/ui/skeleton";

export default function BillingSettingsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="surface-card p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="surface-card p-4 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-20" />
              <div className="space-y-2">
                {[...Array(4)].map((_, j) => (
                  <Skeleton key={j} className="h-3 w-full" />
                ))}
              </div>
              <Skeleton className="h-9 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
