import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, Bell, Building2, Calendar, FileText, PenLine, Users } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { daysUntil } from "@/lib/utils";
import type { Contract, ContractNotificationLog, ContractOccupant } from "@/lib/types";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import ContractDocumentsPanel from "@/components/ContractDocumentsPanel";
import ContractActions from "./ContractActions";
import NotificationPanel from "./NotificationPanel";
import ContractSignatures from "./ContractSignatures";

const AMENITY_KEYS = [
  "ac",
  "fridge",
  "microwave",
  "sofa",
  "futon",
  "mini_blinds",
  "mirror_doors",
  "renovated_bathroom",
  "wall_art",
  "parking",
  "room_count",
  "fan_count",
  "stool_count",
  "stove_count",
  "key_count",
  "parking_spot",
] as const;

export default async function ContractDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const t = await getTranslations("contracts.detail");
  const tr = await getTranslations("contracts.renewal");
  const f = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: contract, error }, { data: tenantsData }, { data: notifLogs }, { data: profile }] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, property:properties(*), tenant:tenants(*), occupants:contract_occupants(*)")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single(),
    supabase.from("tenants").select("*").eq("owner_id", user.id).order("full_name"),
    supabase
      .from("contract_notification_logs")
      .select("*")
      .eq("contract_id", params.id)
      .eq("owner_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(20),
    supabase.from("profiles").select("email").eq("id", user.id).single(),
  ]);

  if (error || !contract) notFound();

  const c = contract as Contract;
  const daysLeft = daysUntil(c.lease_end);
  const coTenants = (c.occupants ?? []).filter((o) => o.role === "co_tenant") as ContractOccupant[];
  const logs = (notifLogs ?? []) as ContractNotificationLog[];
  const landlordEmail = (profile as { email?: string } | null)?.email ?? user.email ?? "";

  const day = (d: string | null | undefined) =>
    d ? f.dateTime(new Date(d.length === 10 ? `${d}T12:00:00` : d), { dateStyle: "medium" }) : null;
  const money = (n: number | null | undefined) => f.number(Number(n) || 0, "money");
  const ssn = (s: string | null | undefined) => (s ? `xxx-xx-${s}` : null);

  const amenityLabel = (k: string, v: string | number | boolean) => {
    const known = (AMENITY_KEYS as readonly string[]).includes(k);
    if (k.endsWith("_count") || k === "parking_spot") {
      const label = known ? t(`amenityCount.${k}` as "amenityCount.room_count") : k.replace(/_/g, " ");
      return `${label}: ${v}`;
    }
    const label = known ? tr(`amenity.${k}` as "amenity.ac") : k.replace(/_/g, " ");
    return typeof v === "number" && v > 1 ? `${v}× ${label}` : label;
  };
  const amenities = Object.entries(c.amenities ?? {}).filter(([, v]) => v !== false && v !== 0 && v !== null && v !== "");

  const title = [c.tenant?.full_name, c.property?.name].filter(Boolean).join(" · ") || t("untitled");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/contracts">
            <ArrowLeft />
            {t("back")}
          </Link>
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <StatusBadge status={c.status} />
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{t("term")}</dt>
                <dd className="font-medium text-foreground">
                  {day(c.lease_start)} – {day(c.lease_end)}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{t("rent")}</dt>
                <dd className="tabular font-medium text-foreground">
                  {money(c.rent_amount)}
                  {t("perMonth")}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{t("remaining")}</dt>
                <dd className={daysLeft >= 0 && daysLeft <= 30 ? "font-medium text-warning" : "font-medium text-foreground"}>
                  {daysLeft < 0 ? t("endedAgo", { count: -daysLeft }) : t("daysLeft", { count: daysLeft })}
                </dd>
              </div>
            </dl>
          </div>
          <ContractActions contract={c} availableTenants={tenantsData ?? []} landlordEmail={landlordEmail} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Terms */}
          <Section icon={<Calendar />} title={t("sections.terms")}>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Info label={t("start")} value={day(c.lease_start)} />
              <Info label={t("end")} value={day(c.lease_end)} />
              <Info label={t("duration")} value={t("months", { count: c.lease_months })} />
              <Info label={t("monthlyRent")} value={money(c.rent_amount)} tabular />
              <Info label={t("deposit")} value={money(c.security_deposit)} tabular />
              <Info label={t("dueDay")} value={t("dueDayValue", { day: c.payment_due_day })} />
              <Info label={t("lateAfter")} value={t("lateAfterValue", { day: c.late_fee_day })} />
              <Info label={t("keys")} value={String(c.key_count ?? 0)} tabular />
              <Info label={t("unit")} value={c.unit_number} />
              <Info label={t("sentAt")} value={day(c.sent_at)} />
              <Info label={t("openedAt")} value={day(c.opened_at)} />
              <Info label={t("signedAt")} value={day(c.signed_at)} />
            </dl>
            {amenities.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground">{t("amenities")}</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {amenities.map(([k, v]) => (
                    <li key={k} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                      {amenityLabel(k, v)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Parties */}
          <Section icon={<Users />} title={t("sections.parties")}>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t("tenant")}</h3>
                <dl className="space-y-2">
                  <Info label={t("name")} value={c.tenant?.full_name} />
                  <Info label={t("email")} value={c.tenant?.email} />
                  <Info label={t("phone")} value={c.tenant?.phone} />
                  <Info label={t("license")} value={c.tenant?.license_number} />
                  <Info label={t("ssn")} value={ssn(c.tenant?.ssn_last4)} />
                  <Info label={t("address")} value={c.tenant?.current_address} />
                  <Info
                    label={t("occupants")}
                    value={c.occupant_names?.length ? c.occupant_names.join(", ") : String(c.occupant_count ?? "")}
                  />
                </dl>
              </div>
              <div className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden />
                  {t("property")}
                </h3>
                <dl className="space-y-2">
                  <Info label={t("name")} value={c.property?.name} />
                  <Info label={t("address")} value={c.property?.address} />
                  <Info
                    label={t("city")}
                    value={[c.property?.city, c.property?.state].filter(Boolean).join(", ") || null}
                  />
                  <Info label={t("unit")} value={c.unit_number} />
                </dl>
              </div>
              {coTenants.map((ct, i) => (
                <div key={ct.id} className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("coTenant", { n: i + 2 })}</h3>
                  <dl className="space-y-2">
                    <Info label={t("name")} value={ct.full_name} />
                    <Info label={t("email")} value={ct.email} />
                    <Info label={t("phone")} value={ct.phone} />
                    <Info label={t("license")} value={ct.license_number} />
                    <Info label={t("ssn")} value={ssn(ct.ssn_last4)} />
                    <Info label={t("address")} value={ct.current_address} />
                    <Info label={t("signedAt")} value={day(ct.signed_at)} />
                  </dl>
                </div>
              ))}
            </div>
          </Section>

          {/* Documents */}
          <Section icon={<FileText />} title={t("sections.documents")}>
            <ContractDocumentsPanel contractId={c.id} />
          </Section>
        </div>

        <div className="space-y-6">
          {/* Signatures */}
          <Section icon={<PenLine />} title={t("sections.signatures")}>
            <ContractSignatures
              contractId={c.id}
              tenantName={c.tenant?.full_name}
              landlordSignature={c.landlord_signature}
              tenantSignature={c.tenant_signature}
              coTenantSignatures={coTenants
                .map((ct, i) => ({
                  id: ct.id,
                  label: `${t("coTenant", { n: i + 2 })} · ${ct.full_name}`,
                  signature: ct.signature,
                }))
                .filter((ct): ct is { id: string; label: string; signature: string } => !!ct.signature)}
            />
          </Section>

          {/* Notifications */}
          <Section icon={<Bell />} title={t("sections.notifications")}>
            <NotificationPanel
              contractId={c.id}
              initialSuppressed={c.suppress_notifications ?? false}
              initialLogs={logs}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-surface p-4 md:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Info({ label, value, tabular }: { label: string; value?: string | null; tabular?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={tabular ? "tabular text-right font-medium text-foreground" : "text-right font-medium text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
