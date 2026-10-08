import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
  return (
    <div className="max-w-3xl space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4 md:p-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  );
}
