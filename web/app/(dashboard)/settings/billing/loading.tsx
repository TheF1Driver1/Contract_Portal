import { Skeleton } from "@/components/ui/skeleton";

export default function BillingSettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4 md:p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-44" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-surface p-4 md:p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-20" />
            {[0, 1, 2].map((j) => <Skeleton key={j} className="h-3 w-full" />)}
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
