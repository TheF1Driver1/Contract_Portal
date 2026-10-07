"use client";

// recharts is heavy and browser-only; lazy-load them from a client
// boundary (Next 15+ disallows `ssr: false` inside Server Components).
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const chartSkeleton = () => <Skeleton className="h-[200px] w-full" />;

export const CashflowChart = dynamic(() => import("@/components/CashflowChart"), { ssr: false, loading: chartSkeleton });
export const ExpenseIncomeChart = dynamic(() => import("@/components/ExpenseIncomeChart"), { ssr: false, loading: chartSkeleton });
export const MarketStatsWidget = dynamic(() => import("@/components/MarketStatsWidget"), { ssr: false, loading: chartSkeleton });
export const RentVsMarketChart = dynamic(() => import("@/components/RentVsMarketChart"), { ssr: false, loading: chartSkeleton });
