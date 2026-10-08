import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Progress = { property: boolean; tenant: boolean; contract: boolean; sent: boolean; signed: boolean };

/** Activation checklist for new landlords; hidden once every step is done. */
export async function GettingStarted({ progress }: { progress: Progress }) {
  const t = await getTranslations("dashboard.start");
  const steps = [
    { key: "property", done: progress.property, href: "/properties?new=1", alt: { href: "/properties?import=1", label: t("importCsv") } },
    { key: "tenant", done: progress.tenant, href: "/tenants?new=1", alt: { href: "/tenants?import=1", label: t("importCsv") } },
    { key: "contract", done: progress.contract, href: "/contracts/new" },
    { key: "sent", done: progress.sent, href: "/contracts?status=draft" },
    { key: "signed", done: progress.signed, href: "/contracts?status=sent" },
  ] as const;
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done)!;

  return (
    <section aria-labelledby="start-title" className="rounded-xl border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="start-title" className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground tabular">{t("progress", { done: doneCount, total: steps.length })}</p>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-surface-muted" aria-hidden>
        <div className={cn("h-1.5 rounded-full bg-primary", ["w-0", "w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"][doneCount])} />
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((s, i) => (
          <li key={s.key} className={cn("flex items-center gap-3 rounded-lg px-2 py-2", s.key === next.key && "bg-primary-soft")}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                s.done ? "bg-success text-primary-foreground" : "border border-border-strong text-muted-foreground"
              )}
              aria-hidden
            >
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("min-w-0 flex-1 text-sm", s.done && "text-muted-foreground line-through")}>
              {t(`steps.${s.key}`)}
              <span className="sr-only">{s.done ? ` (${t("done")})` : ""}</span>
            </span>
            {!s.done && (
              <span className="flex shrink-0 items-center gap-3">
                {"alt" in s && s.alt && (
                  <Link href={s.alt.href} className="hidden text-xs text-muted-foreground underline-offset-4 hover:underline sm:inline">
                    {s.alt.label}
                  </Link>
                )}
                <Link href={s.href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  {t(`cta.${s.key}`)} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
