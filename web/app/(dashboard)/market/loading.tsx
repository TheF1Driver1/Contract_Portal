import { Skeleton } from "@/components/ui/skeleton";

export default function MarketLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="hidden h-20 rounded-xl md:block" />
      <Skeleton className="h-10 w-28 md:hidden" />
      <Skeleton className="h-[60dvh] min-h-80 rounded-xl md:h-[600px]" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-surface p-4 md:p-5">
            <Skeleton className="h-5 w-32" />
            {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-8 w-full" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
