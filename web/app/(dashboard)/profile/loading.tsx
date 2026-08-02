import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="surface-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 rounded-xl" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}
