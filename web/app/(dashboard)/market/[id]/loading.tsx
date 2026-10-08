import { Skeleton } from "@/components/ui/skeleton";

export default function MarketDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded-xl border bg-surface p-4">
            <Skeleton className="size-4" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-xl border bg-surface p-4 md:p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-2 w-full" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
      </div>
    </div>
  );
}
