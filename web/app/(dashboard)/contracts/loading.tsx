import { Skeleton } from "@/components/ui/skeleton";

export default function ContractsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      {/* Phones: cards */}
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      {/* Desktop: table */}
      <div className="hidden rounded-lg border bg-surface md:block">
        <div className="border-b p-3">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 border-b p-3 last:border-0">
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-14 rounded-xl" />
    </div>
  );
}
