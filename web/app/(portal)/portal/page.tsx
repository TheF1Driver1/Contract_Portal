export const dynamic = 'force-dynamic';

import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Download, Eye, FileSignature, FileText, MapPin, PenLine } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";

interface PortalContract {
  id: string;
  status: string;
  lease_start: string | null;
  lease_end: string | null;
  rent_amount: number | null;
  unit_number: string | null;
  pdf_url: string | null;
  property: { name: string | null; address: string | null; city: string | null } | null;
}

/** Statuses where the tenant still has to sign. */
const CLOSED = new Set(["signed", "expired", "cancelled"]);

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("portal");
  const f = await getFormatter();
  const admin = createAdminClient();

  const { data: invites } = await admin
    .from("tenant_invites")
    .select("contract_id")
    .eq("used_by", user.id)
    .eq("used", true)
    .order("used_at", { ascending: false });

  const ids = [...new Set((invites ?? []).map((i) => i.contract_id as string).filter(Boolean))];

  let contracts: PortalContract[] = [];
  if (ids.length > 0) {
    const { data } = await admin
      .from("contracts")
      .select("id, status, lease_start, lease_end, rent_amount, unit_number, pdf_url, property:properties(name, address, city)")
      .in("id", ids);
    const byId = new Map(((data ?? []) as unknown as PortalContract[]).map((c) => [c.id, c]));
    // Keep invite order (most recently redeemed first), pending signatures on top.
    contracts = ids
      .map((id) => byId.get(id))
      .filter((c): c is PortalContract => Boolean(c))
      .sort((a, b) => Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status)));
  }

  const day = (d: string | null) => (d ? f.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "medium" }) : "—");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <div className="mb-6 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {contracts.length === 0 ? (
        <EmptyState icon={FileText} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <section aria-labelledby="contracts-heading" className="space-y-3">
          <h2 id="contracts-heading" className="sr-only">
            {t("count", { count: contracts.length })}
          </h2>
          <ul className="space-y-3">
            {contracts.map((c) => {
              const pending = !CLOSED.has(c.status);
              const badgeStatus = pending ? "pending" : c.status;
              const address = [c.property?.address, c.property?.city].filter(Boolean).join(", ");
              return (
                <li key={c.id} className="rounded-xl border border-border bg-surface p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {c.property?.name || t("propertyFallback")}
                        {c.unit_number ? (
                          <span className="font-normal text-muted-foreground"> · {t("unit", { unit: c.unit_number })}</span>
                        ) : null}
                      </h3>
                      {address && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{address}</span>
                        </p>
                      )}
                    </div>
                    <StatusBadge status={badgeStatus} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("rent")}</dt>
                      <dd className="tabular font-medium text-foreground">
                        {c.rent_amount != null ? f.number(c.rent_amount, "money") : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("period")}</dt>
                      <dd className="text-foreground">
                        {day(c.lease_start)} – {day(c.lease_end)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    {pending ? (
                      <Button asChild size="lg" className="w-full sm:w-auto">
                        <Link href={`/portal/sign/${c.id}`}>
                          <PenLine aria-hidden />
                          {t("actions.sign")}
                        </Link>
                      </Button>
                    ) : c.status === "signed" && c.pdf_url ? (
                      <>
                        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                          <Link href={`/portal/sign/${c.id}`}>
                            <Eye aria-hidden />
                            {t("actions.view")}
                          </Link>
                        </Button>
                        <Button asChild size="lg" className="w-full sm:w-auto">
                          <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" download>
                            <Download aria-hidden />
                            {t("actions.download")}
                          </a>
                        </Button>
                      </>
                    ) : (
                      <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                        <Link href={`/portal/sign/${c.id}`}>
                          {c.status === "signed" ? <FileSignature aria-hidden /> : <Eye aria-hidden />}
                          {t("actions.view")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
