"use client";

// recharts is heavy and browser-only; lazy-load them from a client
// boundary (Next 15+ disallows `ssr: false` inside Server Components).
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";


export const RentExpenseChart = dynamic(() => import("@/components/dashboard/RentExpenseChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
