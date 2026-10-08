import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, FileSpreadsheet, FileText, Landmark, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/app/PageHeader";
import { ResidencyCard } from "@/components/tax/ResidencyCard";
import { ReviewNotice } from "@/components/tax/ReviewNotice";
import { getTaxResidency } from "@/lib/tax/load";
import { cn } from "@/lib/utils";

export default async function ReportsIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const t = await getTranslations("tax.index");
  const residency = await getTaxResidency(supabase, user.id);

  const cards: { href: string; key: "annual" | "scheduleE" | "crim"; icon: LucideIcon; recommended: boolean }[] = [
    { href: "/reports/annual", key: "annual", icon: FileSpreadsheet, recommended: residency !== "non_resident" },
    { href: "/reports/schedule-e", key: "scheduleE", icon: FileText, recommended: residency === "non_resident" },
    { href: "/reports/crim", key: "crim", icon: Landmark, recommended: false },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ResidencyCard initial={residency} />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map(({ href, key, icon: Icon, recommended }) => (
          <li key={key}>
            <Link
              href={href}
              className={cn(
                "group flex h-full flex-col gap-3 rounded-xl border bg-surface p-4 transition-colors hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none md:p-5",
                recommended ? "border-primary" : "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                {recommended && (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-foreground">{t("recommended")}</span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-foreground">{t(`${key}Title`)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t(`${key}Body`)}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                {t("open")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ReviewNotice />
    </div>
  );
}
