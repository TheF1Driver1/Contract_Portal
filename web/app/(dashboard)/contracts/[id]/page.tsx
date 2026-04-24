import { createClient } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import type { Contract } from "@/lib/types";
import { ArrowLeft, User, Building2, DollarSign, Calendar, Key, AlertTriangle } from "lucide-react";
import ContractActions from "./ContractActions";

const STATUS_PILL: Record<string, string> = {
  signed:  "pill-active",
  sent:    "pill-sent",
  draft:   "pill-draft",
  expired: "pill-expired",
};

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, property:properties(*), tenant:tenants(*)")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) notFound();

  const c = contract as Contract;
  const daysLeft = daysUntil(c.lease_end);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/contracts"
            className="btn-tonal mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Contract
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                {c.tenant?.full_name}
              </h1>
              <span className={STATUS_PILL[c.status] ?? "pill-draft"}>{c.status}</span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{c.property?.name}</p>
          </div>
        </div>
        <ContractActions contract={c} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tenant */}
        <div className="surface-card space-y-3">
          <SectionLabel icon={<User className="h-3.5 w-3.5" />} label="Tenant" />
          <InfoRow label="Name"           value={c.tenant?.full_name} />
          <InfoRow label="Email"          value={c.tenant?.email} />
          <InfoRow label="Phone"          value={c.tenant?.phone} />
          <InfoRow label="License #"      value={c.tenant?.license_number} />
          <InfoRow label="SSN (last 4)"   value={c.tenant?.ssn_last4 ? `xxx-xx-${c.tenant.ssn_last4}` : null} />
          <InfoRow label="Address"        value={c.tenant?.current_address} />
          <InfoRow
            label="Occupants"
            value={c.occupant_names?.length ? c.occupant_names.join(", ") : String(c.occupant_count)}
          />
        </div>

        {/* Property */}
        <div className="surface-card space-y-3">
          <SectionLabel icon={<Building2 className="h-3.5 w-3.5" />} label="Property" />
          <InfoRow label="Name"    value={c.property?.name} />
          <InfoRow label="Address" value={c.property?.address} />
          <InfoRow label="City"    value={`${c.property?.city ?? ""}, ${c.property?.state ?? ""}`} />
          <InfoRow label="Unit"    value={c.unit_number} />
          {c.amenities && Object.keys(c.amenities).length > 0 && (
            <div className="pt-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Amenities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(c.amenities).map(([k, v]) => {
                  if (v === false || v === 0) return null;
                  const label = k.replace(/_/g, " ");
                  return (
                    <span
                      key={k}
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                      style={{ background: "var(--surface-container)", color: "var(--text-primary)" }}
                    >
                      {typeof v === "number" && v > 1 ? `${v}× ` : ""}{label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="surface-card space-y-3">
          <SectionLabel icon={<DollarSign className="h-3.5 w-3.5" />} label="Payment" />
          <InfoRow label="Monthly Rent"     value={formatCurrency(c.rent_amount)} />
          <InfoRow label="Security Deposit" value={formatCurrency(c.security_deposit)} />
          <InfoRow label="Due Day"          value={`${c.payment_due_day}th of month`} />
          <InfoRow label="Late After"       value={`Day ${c.late_fee_day}`} />
          <InfoRow label="Keys"             value={String(c.key_count)} icon={<Key className="h-3 w-3" />} />
        </div>

        {/* Lease */}
        <div className="surface-card space-y-3">
          <SectionLabel icon={<Calendar className="h-3.5 w-3.5" />} label="Lease" />
          <InfoRow label="Start"    value={formatDate(c.lease_start)} />
          <InfoRow label="End"      value={formatDate(c.lease_end)} />
          <InfoRow label="Duration" value={`${c.lease_months} months`} />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Days Remaining</span>
            {daysLeft < 0 ? (
              <span className="pill-expired">Expired</span>
            ) : daysLeft <= 30 ? (
              <span className="pill-sent flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {daysLeft} days
              </span>
            ) : (
              <span className="text-sm font-semibold">{daysLeft} days</span>
            )}
          </div>
          {c.signed_at  && <InfoRow label="Signed"  value={formatDate(c.signed_at)} />}
          {c.sent_at    && <InfoRow label="Sent"    value={formatDate(c.sent_at)} />}
          {c.opened_at  && <InfoRow label="Opened"  value={formatDate(c.opened_at)} />}
        </div>
      </div>

      {/* Signatures */}
      {(c.landlord_signature || c.tenant_signature) && (
        <div className="surface-card">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Signatures
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {c.landlord_signature && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Landlord
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.landlord_signature}
                  alt="Landlord signature"
                  className="h-20 w-full rounded-xl object-contain"
                  style={{ background: "var(--surface-container)" }}
                />
              </div>
            )}
            {c.tenant_signature && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Tenant
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.tenant_signature}
                  alt="Tenant signature"
                  className="h-20 w-full rounded-xl object-contain"
                  style={{ background: "var(--surface-container)" }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 pb-1 border-b" style={{ borderColor: "var(--surface-container)" }}>
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="flex items-center gap-1 text-right text-sm font-semibold">
        {icon}
        {value}
      </span>
    </div>
  );
}
