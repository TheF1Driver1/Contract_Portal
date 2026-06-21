import { Skeleton } from "@/components/ui/skeleton";

export default function ManagersLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>
      <div className="surface-card p-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-7 w-16 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
