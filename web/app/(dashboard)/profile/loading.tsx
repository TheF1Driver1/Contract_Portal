import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div aria-busy="true">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="mb-6 flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full md:rounded-md" />)}
      </div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid max-w-2xl gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-4 rounded-xl border border-border bg-surface p-4 md:p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
