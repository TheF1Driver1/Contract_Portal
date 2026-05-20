import { Skeleton } from "@/components/ui/skeleton";

export default function MarketLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="surface-card p-4 space-y-3">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
