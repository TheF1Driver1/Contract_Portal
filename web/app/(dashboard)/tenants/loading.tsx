import { Skeleton } from "@/components/ui/skeleton";

export default function TenantsLoading() {
  return (
    <div aria-busy="true">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
      {/* Phones: cards */}
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border bg-surface p-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg border bg-surface md:block">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
